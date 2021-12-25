# @squirrel-forge/build-scss
Simple sass/scss wrapper including some useful configuration options.
Made to be compatible with node ^10.0.0, might work on higher versions, but currently not supported or tested.

## Installation

```
npm i @squirrel-forge/build-scss

```

## cli usage

If you installed globally with the *-g* option.
```
build-scss target -b --boolean
build-scss source target -b --boolean

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

1. source - Path from where to read, if a directory, files are fetched with following options:
            ```{ exclude : /\/_[^/]*\.scss$/, extensions : /\.scss/ }```
2. target - Path to write rendered and processed css files

### Options

A long option always override the value of a short option if both are used.

| Short | Long           | Type     | Description                                                     |
|-------|----------------|----------|-----------------------------------------------------------------|
| -c    | --compressed   | bool     | OutputStyle compressed                                          |
| -m    | --with-map     | bool     | Generate sourcemaps                                             |
| -p    | --no-postcss   | bool     | Disable postcss processing                                      |
| -x    | --experimental | str, ... | Disable postcss processing                                      |
| -w    | --colors       | str, ... | Define verbose listing color kib limits, must be 3 integers > 0 |
| -s    | --stats        | bool     | Show stats output                                               |
| -i    | --verbose      | bool     | Show additional info                                            |
| -u    | --loose        | bool     | Run in loose mode, disables the strict option                   |
| -v    | --version      | bool     | Show the application version                                    |

## NPM scripts

When installed locally use following scripts.

```
...
"scripts": {
    "sass:render": "build-scss src/scss dev/css -m",
    "sass:publish": "build-scss src/scss dist/css -c -m",
}
...
```

## Api usage

You can require the ScssBuilder class in your node script and run it, change internal options and extend it easily, look at the cli implementation and code comments to understand what to run in which order, currently there will be no extended documentation on the js api, since code comments should be sufficient to understand what works in which way.
