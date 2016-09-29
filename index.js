"use strict";
var fs = require('fs');
var path = require('path');
var minimatch = require('minimatch');
var webpack = require('webpack');
var DEFAULT_OPTIONS = {
    publicPath: '',
    excludes: ['**/.*', '**/*.map'],
    entry: null,
    inject: {}
};
var ServiceWorkerConfigPlugin = (function () {
    function ServiceWorkerConfigPlugin(options) {
        this.moduleAssets = {};
        this.options = Object.assign({}, DEFAULT_OPTIONS, options);
    }
    ServiceWorkerConfigPlugin.prototype.apply = function (compiler) {
        var _this = this;
        // Grab all assets that are output from a module
        compiler.plugin('compilation', function (compilation) {
            compilation.plugin('module-asset', function (module, file) {
                _this.moduleAssets[file] = path.join(path.dirname(file), path.basename(module.userRequest));
            });
        });
        compiler.plugin('emit', function (compilation, callback) {
            _this.handleOutput(compiler, compilation, callback);
        });
    };
    ServiceWorkerConfigPlugin.prototype._getEntryItemFromName = function (entry) {
        var outputName = path.basename(entry);
        return { file: entry, output: this.options.publicPath + outputName };
    };
    ServiceWorkerConfigPlugin.prototype.handleOutput = function (compiler, compilation, callback) {
        var _this = this;
        // do we want to minify the output or not?
        var isMinify = (compiler.options.plugins || []).find(function (plugin) {
            return plugin instanceof webpack.optimize.UglifyJsPlugin;
        });
        // track all assets from the build process
        var chunksMap = {};
        var stats = compilation.getStats().toJson();
        // Map Chunk to output
        compilation.chunks.forEach(function (chunk) {
            // Map output chunk name to file output
            chunk.files.forEach(function (file) {
                if (chunk.name) {
                    chunksMap[file] = chunk.name + file.substr(file.lastIndexOf('.'));
                }
                else {
                    chunksMap[file] = file;
                }
            });
        });
        // Map stats.assets to original asset name
        var assets = stats.assets.reduce(function (state, asset) {
            if (chunksMap[asset.name]) {
                state[chunksMap[asset.name]] = asset.name;
            }
            else if (_this.moduleAssets[asset.name]) {
                state[_this.moduleAssets[asset.name]] = asset.name;
            }
            else {
                state[asset.name] = asset.name;
            }
            return state;
        }, {});
        // Create the variables that we will need to inject
        var injectables = {};
        // Get a list of the assets to inject
        if (this.options.excludes) {
            var assetNames = Object.keys(assets);
            var excludes_1 = this.options.excludes;
            // return the assets that do not match any of the exclude patterns
            assetNames.forEach(function (assetName) {
                var toExclude = excludes_1.findIndex(function (exclude) {
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
        var hasInjectErrors = false;
        Object.keys(this.options.inject).forEach(function (key) {
            if (injectables[key] !== undefined) {
                hasInjectErrors = true;
                compilation.errors.push(new Error("Inject Key already exists: key=\"" + key + "\""));
            }
            else {
                injectables[key] = JSON.stringify(_this.options.inject[key], null, isMinify ? 0 : 2);
            }
        });
        // Don't do any further processing if we have inject errors
        if (hasInjectErrors) {
            callback('ServiceWorkerConfig: Inject Error');
            return;
        }
        // Create JS for each injectable
        var injectablesList = Object.keys(injectables).map(function (key) {
            return "var " + key + " = " + injectables[key] + ";";
        });
        var injectablesSource = isMinify ? injectablesList.join('') : injectablesList.join("\n");
        // Normalize the input
        if (typeof this.options.entry === 'string') {
            this.options.entry = [this._getEntryItemFromName(this.options.entry)];
        }
        else if (!Array.isArray(this.options.entry)) {
            this.options.entry = [this.options.entry];
        }
        else {
            this.options.entry = this.options.entry.map(function (entry) {
                if (typeof entry === 'string') {
                    return _this._getEntryItemFromName(entry);
                }
                return entry;
            });
        }
        var total = this.options.entry.length;
        var done = 0;
        // Stupid waitgroup-ish thing
        var doneCallback = function () {
            done++;
            if (done === total) {
                callback();
            }
        };
        // Go through each serviceworker and create the asset
        this.options.entry.forEach(function (entry) {
            var filePath = path.resolve(entry.file);
            fs.readFile(filePath, function (err, template) {
                if (err) {
                    compiler.warnings.push(err);
                }
                else {
                    // should be undefined...
                    if (compilation.assets[entry.output]) {
                        compiler.warnings.push(new Error("ServiceWorkerConfig: asset with the same name already exists; name=\"" + entry.output));
                    }
                    else {
                        var sourceStr_1 = injectablesSource + "\n" + template;
                        compilation.assets[entry.output] = {
                            source: function () {
                                return sourceStr_1;
                            },
                            size: function () {
                                return Buffer.byteLength(sourceStr_1, 'utf8');
                            }
                        };
                    }
                }
                doneCallback();
            });
        });
    };
    return ServiceWorkerConfigPlugin;
}());
module.exports = ServiceWorkerConfigPlugin;
