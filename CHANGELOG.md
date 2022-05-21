# Changelog

## 0.8.2
 - Fixed source path matching for windows backslash paths.
 - Convert all *ScssBuildData* paths with *safePath* method. 
 - Added *ScssBuildData.safePath()* method for ensuring forward slash paths.
 - Notes on the windows path issues: https://github.com/sass/dart-sass/issues/669

## 0.8.1
 - Update dependencies.
 - Note: *sass* package now requires *node >= 12.0.0*, but is still functional on *node@10.x.x* when using npm, if you are using yarn you must run the builder with *node@12.x.x* as it enforces the node version.

## 0.8.0
 - Migrated to the new node api, including internal refactoring, which only affects the internal js api and makes it more verbose and easier to use.
 - Updated all dependencies including plugins, plugin peer dependencies must be installed manually.
 - Updated and improved plugin loading, including easy custom plugins with options support.
 - Added plugins configs options map and loading.
 - Added *@squirrel-forge/sass-base64-loader* sass function plugin for file content loading.
 - Removed *node-sass-package-importer* package in favor of *@squirrel-forge/sass-package-importer* for the new api.
 - Support *.sass* file extension for recursive directory loading.
 - Added custom environment injection var *$scss-env* that contains the environment name and *$scss-production* that contains a boolean.
 - Added *-e* and *--env* option set a custom env name.
 - Added *-p* and *--production* as shortcut for *--env=production* and *--compressed* option.
 - Added *-d* and *--development* as shortcut for *--env=development* and *--with-map* option.
 - Added *-o* and *--options* option to set options source directory.
 - Added *--defaults* option to deploy plugins defaults options config.

## 0.7.3
 - Update *node-util* package.
 - Internal updates and cleanups for *--experimental* option.
 - Removed short option *-w* for *--colors* option, to free it for future use.

## 0.7.2
 - Added experimental as boolean option to use all experimentals.
 - Improved *load-base64* runtime cache.
 - Added source and target paths to stats if not displayed with verbose.
 - Fixed process spinner start collision with verbose output.

## 0.7.0
 - Added *-x*, *--experimental* option to enable experimental functions.
 - Added *load-base64($source,$mime:null)* experimental sass function.
 - Added experimental sass function support.
 - Added async sass render support to api.
 - Updated node-cfx and node-util.

## 0.6.2
 - Added better stats display.
 - Added Timer util for detailed measurements.
 - Migrate to node-util@1.0.0 package.
 - Updated to sass@1.45.0 package.
 - Added *-w* *--colors* options for setting highlight limits.

## 0.5.3
 - Added progress, better runtime errors and timer.
 - Removed packages that are installed by utils package.

## 0.5.2
 - Added *-p*, *--no-postcss* option to disable postcss processing.

## 0.5.1
 - Updated *node-util*.

## 0.5.0
 - Core features prototype.
