# Webpack ServiceWorker Config Plugin

A webpack for injecting variables into the serviceworker.

## Usage

In your webpack.config.js file:

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

The entry option can be in one of 3 forms:

1. String: `entry: 'myserviceworker.js'`
2. Object: `entry: {file: 'myserviceworker.js', output: 'sw.js'}`
3. An array (for multiple serviceworkers) of string or objects: `entry: ['sw1.js', 'sw2.js']` OR `[{file: 'sw1.js', output: 'homePageSw.js'}...]`


In your app, register the serviceworker with the filename.

eg:

```
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('myserviceworker.js').then(function() {
    // code
  });
}
```

The resulting serviceworker will have the variables injected at the top:

```javascript
var CONFIG_1 = 'my data';
var CONFIG_2 = 'my other config data';
```

There will always be at least one variable (SW_ASSETS) injected into the serviceworker.
You use this variable to cache resources.
This is inspired by the [Webpack Manifest Plugin](https://github.com/danethurber/webpack-manifest-plugin)

```javascript
var SW_ASSETS = {
  "myimage.jpg": "myimage.sdafz9012909fd0adf.jpg"
}
```

## Configuration

The plugin is configuration with the following options:

```javascript
new ServiceWorkerPlugin({
  entry: 'my-service-worker.js',
  publicPath: '/',
  excludes: [],
  inject: {}
})
```

### Options

- `entry`: the source for your serviceworker to inject variables into
- `excludes`: any assets you want to exclude from thw `SW_ASSETS` object
- `publicPath`: a prefix for where your serviceworker will live in
- `inject`: an object where the top level fields are variables to be injected into your serviceworker

