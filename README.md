# Webpack ServiceWorker Config Plugin

A webpack plugin for injecting variables into a serviceworker.

## Usage

In `webpack.config.js`:

```javascript

var ServiceWorkerPlugin = require('serviceworker-config-webpack-plugin');

module.exports {
  // ...
  plugins: [
    new ServiceWorkerPlugin({
      entry: 'myserviceworker.js',
      inject: {
        CONFIG_1: 'my data',
        CONFIG_2: 'my other config data'
      }
    })
  ]
}
```

`entry` can be in one of the following:

1. String: `entry: 'myserviceworker.js'`
2. Object: `entry: {file: 'myserviceworker.js', output: 'sw.js'}`
3. Array (for multiple serviceworkers): `entry: ['sw1.js', 'sw2.js']` OR `[{file: 'sw1.js', output: 'homePageSw.js'}...]`

If the entry provided is a string (as a string itself or a string in the array), the default output name will be the same
as the entry.


In your app, register the serviceworker with the output filename.

eg:

```
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('myserviceworker.js').then(function() {
    // code
  });
}
```

Following the example above, the serviceworker will have the following custom variables injected at the top:

```javascript
var CONFIG_1 = 'my data';
var CONFIG_2 = 'my other config data';
```

There will always be at least one variable (SW_ASSETS) injected into serviceworkers.
You use this variable to cache network assets.
This is inspired by the [Webpack Manifest Plugin](https://github.com/danethurber/webpack-manifest-plugin).

```javascript
var SW_ASSETS = {
  "myimage.jpg": "myimage.sdafz9012909fd0adf.jpg",
  "mycss.css": "mycss.asdf901290an.css"
}
```

## Configuration

The plugin can be configured with the following options:

```javascript
new ServiceWorkerPlugin({
  entry: 'my-service-worker.js',
  publicPath: '/',
  excludes: [],
  inject: {}
})
```

### Options

- `entry`: serviceworker source
- `excludes`: array of glob patterns corresponding to files you want to exclude from `SW_ASSETS`
- `publicPath`: prefix to where your serviceworker will be output to
- `inject`: an object where the top level fields are variables to be injected into your serviceworker

