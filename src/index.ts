const fs = require('fs');
const path = require('path');
const minimatch = require('minimatch');
import webpack = require('webpack');

const DEFAULT_OPTIONS = {
    publicPath: '',
    excludes: ['**/.*', '**/*.map'],
    entry: null,
    inject: {}
};

class ServiceWorkerConfigPlugin {
    options: any;
    moduleAssets: any;
    constructor(options) {
        this.moduleAssets = {};
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }

    apply(compiler) {
        // Grab all assets that are output from a module
        compiler.plugin('compilation', (compilation) => {
            compilation.plugin('module-asset', (module, file) => {
                this.moduleAssets[file] = path.join(
                    path.dirname(file),
                    path.basename(module.userRequest)
                );
            });
        });

        compiler.plugin('emit', (compilation, callback) => {
            this.handleOutput(compiler, compilation, callback);
        });
    }

    _getEntryItemFromName(entry) {
        const outputName = path.basename(entry);
        return {file: entry, output: this.options.publicPath + outputName};
    }

    handleOutput(compiler, compilation, callback) {
        // do we want to minify the output or not?
        const isMinify = (compiler.options.plugins || []).find((plugin) => {
            return plugin instanceof webpack.optimize.UglifyJsPlugin;
        });

        // track all assets from the build process
        let chunksMap = {};
        const stats = compilation.getStats().toJson();

        // Map Chunk to output
        compilation.chunks.forEach((chunk) => {
            // Map output chunk name to file output
            chunk.files.forEach((file) => {
                if (chunk.name) {
                    chunksMap[file] = chunk.name + file.substr(file.lastIndexOf('.'));
                } else {
                    chunksMap[file] = file;
                }
            });
        });

        // Map stats.assets to original asset name
        const assets = stats.assets.reduce((state, asset) => {
            if (chunksMap[asset.name]) {
                state[chunksMap[asset.name]] = asset.name;
            } else if (this.moduleAssets[asset.name]) {
                state[this.moduleAssets[asset.name]] = asset.name;
            } else {
                state[asset.name] = asset.name;
            }
            return state;
        }, {});


        // Create the variables that we will need to inject
        const injectables = {};

        // Get a list of the assets to inject
        if (this.options.excludes) {
            const assetNames = Object.keys(assets);
            const excludes = this.options.excludes;
            // return the assets that do not match any of the exclude patterns
            assetNames.forEach((assetName) => {
                const toExclude = excludes.findIndex((exclude) => {
                    return minimatch(assetName, exclude);
                }) > -1;

                if (toExclude) {
                    delete assets[assetName];
                }
            });
        }

        // Add the assets into the injectables source
        injectables['SW_ASSETS'] = JSON.stringify(assets, null, isMinify ? 0 : 2);

        // Add all items in 'inject' into the injectables array
        let hasInjectErrors = false;
        Object.keys(this.options.inject).forEach((key) => {
            if (injectables[key] !== undefined) {
                hasInjectErrors = true;
                compilation.errors.push(new Error(
                    `Inject Key already exists: key="${key}"`
                ));
            } else {
                injectables[key] = JSON.stringify(
                    this.options.inject[key],
                    null,
                    isMinify ? 0 : 2
                );
            }
        });

        // Don't do any further processing if we have inject errors
        if (hasInjectErrors) {
            callback('ServiceWorkerConfig: Inject Error');
            return;
        }

        // Create JS for each injectable
        const injectablesList = Object.keys(injectables).map((key) => {
            return `var ${key} = ${injectables[key]};`;
        });
        const injectablesSource = isMinify ? injectablesList.join('') : injectablesList.join("\n");

        // Normalize the input
        if (typeof this.options.entry === 'string') {
            this.options.entry = [this._getEntryItemFromName(this.options.entry)];
        } else if (!Array.isArray(this.options.entry)) {
            this.options.entry = [this.options.entry];
        } else {
            this.options.entry = this.options.entry.map((entry) => {
                if (typeof entry === 'string') {
                    return this._getEntryItemFromName(entry);
                }
                return entry;
            });
        }

        const total = this.options.entry.length;
        let done = 0;

        // Stupid waitgroup-ish thing
        const doneCallback = () => {
            done++;
            if (done === total) {
                callback();
            }
        };

        // Go through each serviceworker and create the asset
        this.options.entry.forEach((entry) => {
            const filePath = path.resolve(entry.file);
            fs.readFile(filePath, (err, template) => {
                if (err) {
                    compiler.warnings.push(err);
                } else {
                    // should be undefined...
                    if (compilation.assets[entry.output]) {
                        compiler.warnings.push(new Error(
                            `ServiceWorkerConfig: asset with the same name already exists; name="${entry.output}`
                        ));
                    } else {
                        const sourceStr = injectablesSource + "\n" + template;
                        compilation.assets[entry.output] = {
                            source() {
                                return sourceStr;
                            },
                            size() {
                                return Buffer.byteLength(sourceStr, 'utf8');
                            }
                        }
                        doneCallback();
                    }
                }
            });
        });
    }
}

module.exports = ServiceWorkerConfigPlugin;
