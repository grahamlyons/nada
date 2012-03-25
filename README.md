# Nada Node framework [![Build Status](https://secure.travis-ci.org/grahamlyons/nada.png?branch=master)](http://travis-ci.org/grahamlyons/nada)

Little framework running on Node

Use like:
    var nada = require('nada'),
        app = nada.app;

    app.get('/', function() {
        return 'Hello world';
    });

    nada.start();
