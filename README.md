# asar-reader
Quickly read ASAR files, asynchronously

## Usage

### ```var instance = new asarReader(pathToAsar, options)```

**Options**

* **keepOpenFor** - keep the file descriptor open for ms after last used; default is 500 ms

#### ```instance.listFiles(function(err, files) { })```

#### ```instance.readFile(path, function(err, readStream) { })```
