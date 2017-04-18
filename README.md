# asar-reader
Quickly read ASAR files, asynchronously

## Usage

### ```var instance = new asarReader(pathToAsar, options)```

**Options**

* **keepOpenFor** - keep the file descriptor open for ms after last used; default is 500 ms

#### ```instance.listFiles(function(err, files) { })```

**files** is an object where the key is the path and the value is the object you have to pass to `instance.readFile`

#### ```instance.readFile(fileObj, function(err, readStream) { })```

#### ```instance.getHeader(function(err, header) { })```

Get raw ASAR header