var litmus = require('litmus'),
    nada = require('../lib/nada'),
    fs = require('fs'),
    crypto = require('crypto');

function mockRequest(method, url, headers) {
    var headers = headers ? headers : {};
    return {
        method: method.toUpperCase(),
        url: url,
        headers: headers
    };
}

exports.test = new litmus.Test('Test nada framework', function() {

    var response = new nada.Response(),
        test = this;

    function isNotFound(response, message) {

        test.is(
            response.body,
            'Not found', 
            'Not found in body: ' + message
        );
        test.is(
            response.status,
            404, 
            'Status is 404: ' + message
        );
    }

    function isSuccess(response, message, body) {

        test.is(
            response.status,
            200, 
            'Status is 200: ' + message);

        if(body) {
            test.is(
                response.body,
                body, 
                'Expected body returned: ' + message);
        }

    }

    function isError(response, message) {

        test.is(
            response.status,
            500, 
            'Status is 500: ' + message);

    }

    this.ok(response.setBody, 'Response has setBody method');
    this.ok(response.setContentType, 'Response has setContentType method');
    this.ok(response.setHeader, 'Response has setHeader method');
    this.ok(response.send, 'Response has send method');

    this.async('test basic app instantiation', function(handler) {

        var app = nada.app
        test = this;

        this.ok(app instanceof nada.App, 'nada.app is instance of the App object');
        this.ok(app.get, 'app has get handler');
        this.ok(app.post, 'app has post handler');
        this.ok(app.put, 'app has put handler');
        this.ok(app.del, 'app has del handler');

        handler.resolve();
    });

    this.async('test simple route', function(handler) {
        var app = nada.app,
            test = this,
            response;

        app.get('/', function(request, response) {
            test.ok(request, 'Callback handler gets passed request');
            test.ok(response, 'Callback handler gets passed response');
            return 'Hello';
        });

        /**
         * Test simple route
         */
        response = app.dispatch(mockRequest('GET', '/'), new nada.Response());

        isSuccess(response, 'Matched route returning simple content', 'Hello');

        response = app.dispatch(mockRequest('HEAD', '/'), new nada.Response()), 

        isSuccess(response, 'Route defined for get is also served for head request');
        
        /**
         * Test unmatched routes
         */
        response = app.dispatch(mockRequest('GET', '/notmatched'), new nada.Response()), 
        isNotFound(response, 'Unmatched route');

        response = app.dispatch(mockRequest('POST', '/'), new nada.Response());
        isNotFound(response, 'POST to GET route');
        response = app.dispatch(mockRequest('PUT', '/'), new nada.Response());
        isNotFound(response, 'PUT to GET route');
        response = app.dispatch(mockRequest('DELETE', '/'), new nada.Response());
        isNotFound(response, 'DELETE to GET route');

        handler.resolve();
    });

    this.async('test other verbs', function(handler) {
        var app = nada.app,
            test = this,
            response;

        app.post('/', function() {
            return 'Done';
        });

        app.put('/', function() {
            return 'Done';
        });

        app.del('/', function() {
            return 'Done';
        });

        response = app.dispatch(mockRequest('POST', '/'), new nada.Response());
        isSuccess(response, 'Matched POST request', 'Done');

        response = app.dispatch(mockRequest('PUT', '/'), new nada.Response());
        isSuccess(response, 'Matched PUT request', 'Done');

        response = app.dispatch(mockRequest('DELETE', '/'), new nada.Response());
        isSuccess(response, 'Matched DELETE request', 'Done');

        handler.resolve();
    });

    this.async('test static route', function(handler) {

        var app = nada.app,
            test = this,
            filename = __dirname + '/test.css',
            content = 'body{ font-family: Comic Sans; }',
            response;

        fs.writeFileSync(filename, content);

        app.addStaticRoute('/style/', __dirname);

        response = app.dispatch(mockRequest('GET', '/style/test.css'), new nada.Response());

        if(response.body.then) {
            response.body.then(function(data) {
                test.is(content, data, 'Got correct stylesheet');
                handler.resolve();
            }, function(err) {
                handler.reject();
            });
        }

        test.is(response.headers['Content-Type'], 'text/css', 'Correct MIME type was set');

        test.finished.then(function() {
            fs.unlinkSync(filename);
        });

    });

    this.async('test etag and content length', function(handler) {
        var app = nada.app,
            expectedEtag,
            hash,
            content = 'Hello¬˚∆ƒ¬˚∆®',
            request,
            mockResponse;

        hash = crypto.createHash('md5');
        hash.update(content);
        expectedEtag = '"'+hash.digest('hex')+'"';

        app.get('/etag', function() {
            return content;
        });

        request = mockRequest('GET', '/etag');
        response = app.dispatch(request, new nada.Response());
        mockResponse = response._response = {
            writeHead: function(status, headers) {
                this.status = status;
                this.headers = headers;
            },
            end: function(body) {
                this.body = body;
            }
        };

        response.send(request);
        this.is(mockResponse.status, 200, 'Got 200 response');
        this.is(mockResponse.headers['Etag'], expectedEtag, 'Got expected etag in response');
        this.is(mockResponse.headers['Content-length'], Buffer.byteLength(content), 'Got corrent content length in response');
        this.is(mockResponse.body, content, 'Got corrent content response');

        request = mockRequest('GET', '/etag', {'if-none-match': expectedEtag});
        response = app.dispatch(request, new nada.Response());
        mockResponse = response._response = {
            writeHead: function(status, headers) {
                this.status = status;
                this.headers = headers;
            },
            end: function(body) {
                this.body = body;
            }
        };

        response.send(request);
        this.is(mockResponse.status, 304, 'Got 304 response');
        this.nok(mockResponse.body, 'No body in 304 response');
        this.is(mockResponse.headers['Etag'], expectedEtag, 'Got expected etag in response');
        this.is(mockResponse.headers['Content-length'], Buffer.byteLength(content), 'Got corrent content length in response');

        request = mockRequest('HEAD', '/etag');
        response = app.dispatch(request, new nada.Response());
        mockResponse = response._response = {
            writeHead: function(status, headers) {
                this.status = status;
                this.headers = headers;
            },
            end: function(body) {
                this.body = body;
            }
        };

        response.send(request);
        this.is(mockResponse.status, 200, 'Got 200 response');
        this.is(mockResponse.headers['Etag'], expectedEtag, 'Got expected etag in response');
        this.is(mockResponse.headers['Content-length'], Buffer.byteLength(content), 'Got corrent content length in response');
        this.nok(mockResponse.body, 'No body in response to HEAD request');

        handler.resolve();
    });

    this.async('Test named parameters for route', function(handler) {

        var app = nada.app,
            test = this,
            response;

        app.get('/insert/:key/:value', function(request, response, key, value) {
            test.ok(request, 'Callback handler gets passed request');
            test.ok(response, 'Callback handler gets passed response');
            test.is(key, 'name', 'Callback handler gets passed named parameter');
            test.is(value, 'graham', 'Callback handler gets passed named parameter');
            return 'Params route';
        });

        /**
         * Test route route with params
         */
        response = app.dispatch(mockRequest('GET', '/insert/name/graham'), new nada.Response());

        isSuccess(response, 'Matched route with params returning simple content', 'Params route');

        handler.resolve();
    });

    this.async('Test error handling', function(handler) {
        
        var app = nada.app,
            test = this,
            response;

        app.get('/simpleroute', function(request, response) {
            throw new Error('Something has gone terribly wrong');
        });

        response = app.dispatch(mockRequest('GET', '/simpleroute'), new nada.Response());

        isError(response, 'Error is caught and returned as 500 response');

        handler.resolve();
    });
    
});
