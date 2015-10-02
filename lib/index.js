'use strict';
var AbstractStrategy = require('rest-me').Strategy,
    util = require('util'),
    Q = require('q'),
    rest = require('rest'),
    URL = require('url'),
    mime = require('rest/interceptor/mime'),
    client = rest.wrap(mime),
    _ = require('lodash');

function SpotifyStrategy(accessToken, version) {
    this.accessToken = accessToken;
    this.version = version || 'v1'
    this.apiEndpoint = 'api.spotify.com' + '/' + this.version;
    this.protocol = 'https';
}

util.inherits(SpotifyStrategy, AbstractStrategy);

SpotifyStrategy.prototype._get = function(path) {
    var parsedUrl = URL.parse(path, true);
    parsedUrl.protocol = parsedUrl.protocol || this.protocol;
    parsedUrl.host = parsedUrl.host || this.apiEndpoint;
    return client({
        method: 'get',
        path: parsedUrl.format(),
        headers: {
            Authorization: 'Bearer ' + this.accessToken
        }
    })
}

SpotifyStrategy.prototype.get = function(path) {
    return this._get(path);
}

SpotifyStrategy.prototype.getPaginatedList = function(path) {
    var done = Q.defer(),
        promises = [];
    var that = this;
    this._get(path).then(function(response) {
        if (!response.entity.total) {
            throw new Error('Path response does not represent a paginated list');
        }

        if (!response.entity.next) {
            done.resolve(response.entity);
        } else {
            var total = parseInt(response.entity.total);
            var firstResults = response.entity.items;
            var next = response.entity.next;
            var parsedUrl = URL.parse(next, true);
            var limit = parseInt(parsedUrl.query.limit);
            var nextOffset = limit;
            while (nextOffset < total) {
                parsedUrl.search = null;
                parsedUrl.query.offset = nextOffset;
                promises.push(that._get(parsedUrl.format()));
                nextOffset += limit;
            }

            Q.all(promises).then(function(data) {
                var nextResults = data.map(function(item) {
                    return item.entity.items;
                });
                var results = _.flatten([firstResults, nextResults], true);
                done.resolve({
                    items: results
                });
            }, function(err) {
                done.reject(err);
            });
        }
    })

    return done.promise;
}

module.exports = SpotifyStrategy;