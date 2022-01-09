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
build-scss target -b --boolean --str=loadBase64,...
build-scss source target -b --boolean --str=loadBase64,...

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

| Short | Long           | Type            | Description                                                                                                                                |
|-------|----------------|-----------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| -c    | --compressed   | bool            | OutputStyle compressed                                                                                                                     |
| -m    | --with-map     | bool            | Generate sourcemaps                                                                                                                        |
| -p    | --no-postcss   | bool            | Disable postcss processing, the autoprefixer plugin won't run                                                                              |
| -x    | --experimental | bool / str, ... | Enable experimental features, use without value or 'all' to enable all features, use comma separated list to enable specific features only |
| -w    | --colors       | str, ...        | Define verbose listing color kib limits, must be 3 integers > 0, default: 102400,204800,307200                                             |
| -s    | --stats        | bool            | Show stats output                                                                                                                          |
| -i    | --verbose      | bool            | Show additional info, useful during development                                                                                            |
| -u    | --loose        | bool            | Run in loose mode, disables the strict option and provides cleaner output when using @debug in your sass                                   |
| -v    | --version      | bool            | Show the application version                                                                                                               |

For development it's recommended to use following command options:
```
build-scss src dist -s -i -u -x
```
And no, this was not designed this way on purpose.

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

## Experimental features

Following all experimental features, these features require the sass async render, which causes a significant performance decrease as of render time, the practical impact mostly depends on the amount of sass code rendered.

```
build-scss src/scss/ dist/css -x={all|feature},...
```

### Load as base64 data url

Feature reference: **loadBase64**

Provides a sass function *load-base64($source,$mime:null)* that loads a file as data url, the mimetype is optional and will be detected at cost of performance if not set. The source argument is evaluated relative to the source root path, irrelevant from where the actual file is that contains the code, see following example:

Sass code:
```scss
.icon {
  &--a {
    background-image: url(load-base64('icon.png'));
  }
  &--b {
    background-image: url(load-base64('icon.jpg', 'image/jpeg'));
  }
}
```

Resulting css:
```css
.icon--a {
    background-image: url("data:image/png;base64,...");
}
.icon--b {
    background-image: url("data:image/jpeg;base64,...");
}
```

## Api usage

You can require the ScssBuilder class in your node script and run it, change internal options and extend it easily, look at the cli implementation and code comments to understand what to run in which order, currently there will be no extended documentation on the js api, since code comments should be sufficient to understand what works in which way.
