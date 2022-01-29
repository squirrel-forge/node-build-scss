# @squirrel-forge/build-scss
Simple sass wrapper including some useful configuration options and extended features like package support and loading files as base64 encoded strings for font and image inclusion.
Made to be compatible with node ^10.0.0, might work on higher versions, but currently not supported or tested.

## Installation

```
npm i @squirrel-forge/build-scss
```

## cli usage

If you installed globally with the *-g* option.
```
build-scss target -b --boolean --str=str,...
build-scss source target -b --boolean --str=str,...
```

For local installations use *npx* to run the build-scss executable.
```
npx build-scss ...
```

### Arguments

The source argument can be a single file path or folder.
The target argument must be a directory and will be created if it does not exist.

#### Using only one argument

the source argument is omitted and assumed to be the current working directory
1. target - Path to write rendered and processed css files

#### Using two arguments

1. source - Path from where to read, if a directory, sources are selected recursively with following options:
            ```{ exclude : /\/_[^/]*\.(sass|scss)$/, extensions : /\.(sass|scss)/ }```
2. target - Path to write rendered and processed css files

### Options

A long option always override the value of a short option if both are used.

| Short | Long           | Type            | Description                                                                                                                                                 |
|-------|----------------|-----------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| -p    | --production   | bool            | Set env to production, strict, compressed, postcss and stats                                                                                                |
| -d    | --development  | bool            | Set env to development, loose, no-postcss, with-map, experimental and stats in verbose                                                                      |
| -e    | --env          | str             | Set custom env name                                                                                                                                         |
| -c    | --compressed   | bool            | OutputStyle compressed                                                                                                                                      |
| -m    | --with-map     | bool            | Generate sourcemaps                                                                                                                                         |
|       | --no-postcss   | bool            | Disable postcss processing, the autoprefixer plugin won't run                                                                                               |
| -x    | --experimental | bool / str, ... | Enable experimental features and load plugins, use without value or 'all' to enable all features, use comma separated list to enable specific features only |
| -o    | --options      | 'no',str        | Load options from this path, unless set to 'no', if not set regular checks apply                                                                            |
|       | --defaults     | bool            | Deploy plugins config to cwd or target directory                                                                                                            |
|       | --colors       | int,int,int     | Define verbose listing color kib limits, must be 3 integers > 0, default: 102400,204800,307200                                                              |
| -s    | --stats        | bool            | Show stats output                                                                                                                                           |
| -i    | --verbose      | bool            | Show additional info, useful during development                                                                                                             |
| -u    | --loose        | bool            | Run in loose mode, disables the strict option and provides cleaner output when using @debug in your sass                                                    |
| -v    | --version      | bool            | Show the application version                                                                                                                                |

For fun, it's recommended to use following command options:
```
build-scss src dist -s -i -u -x
```
And no, this was not designed this way on purpose.

## NPM scripts

When installed locally use following scripts.

```
...
"scripts": {
    "sass:render": "build-scss src/scss dev/css -d",
    "sass:publish": "build-scss src/scss dist/css -p",
}
...
```

## Plugins and experimental features

Following all documented experimental features, the builtin shorthand names are only available when using the cli command.

```
build-scss src/scss/ dist/css -x={all|feature},...
```

### Load files as base64 data url

Feature reference: **b64**

Provides a sass function *base64load($source,$mime)* that loads a file as data url, for more details check [@squirrel-forge/sass-base64-loader](https://www.npmjs.com/package/@squirrel-forge/sass-base64-loader).

### Importing a package

Feature reference: **pi**

Provides a sass importer that will resolve package @import "~package" and @use "~package" statements, for more details check [@squirrel-forge/sass-package-importer](https://www.npmjs.com/package/@squirrel-forge/sass-package-importer).

### Custom plugins

You may load custom plugins with the *-x* or *--experimental* options, you may define plugins as *reference* or *name:reference*.
Plugins are loaded with *require* and no further custom loading is used:

 - Loading a plugin package: install the desired version of the package and use it's name as *reference*.
 - Loading a local file path: use an absolute path or relative to process.cwd() as reference.

#### Plugin structure

Use the *name:reference* syntax and define the *name* in your plugin options config to customize your the options.

```javascript
/**
 * Plugin factory sync
 * @param {Object} options - Plugin options
 * @param {Object} sassOptions - Sass options
 * @param {ScssBuilder} builder - Builder instance
 * @return {void}
 */
module.exports = function plugin( options, sassOptions, builder ) {
    
    // Set sass options, add sass plugins, extend postcss etc
};
```

## Api usage

You can require the ScssBuilder class in your node script and run it, change internal options and extend it easily, look at the cli implementation and code comments to understand what to run in which order, currently there will be no extended documentation on the js api, since code comments should be sufficient to understand what works in which way.
