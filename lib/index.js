'use strict';
var AbstractStrategy = require('rest-me').Strategy,
    util = require('util'),
    rest = require('rest'),
    URL = require('url'),
    mime = require('rest/interceptor/mime'),
    client = rest.wrap(mime);

function SpotifyStrategy(accessToken, version, maxRetries) {
    this.accessToken = accessToken;
    this.version = version || 'v1'
    this.apiEndpoint = 'api.spotify.com' + '/' + this.version;
    this.protocol = 'https';
    this.retries = 0;
    this.maxRetries = maxRetries || 1;
}

util.inherits(SpotifyStrategy, AbstractStrategy);

SpotifyStrategy.prototype._get = function(path) {
    var parsedUrl = URL.parse(path, true);
    parsedUrl.protocol = parsedUrl.protocol || this.protocol;
    parsedUrl.host = parsedUrl.host || this.apiEndpoint;
    var that = this;
    return client({
        method: 'get',
        path: parsedUrl.format(),
        headers: {
            Authorization: 'Bearer ' + this.accessToken
        }
    }).then(function(response) {

        if (response.status.code != 200) {
            that.retries++;
            if (that.retries <= that.maxRetries) {
                return that._get(path);
            }
        }

        return response;
    });
}

SpotifyStrategy.prototype.put = function(path, params) {
    var parsedUrl = URL.parse(path, true);
    parsedUrl.protocol = parsedUrl.protocol || this.protocol;
    parsedUrl.host = parsedUrl.host || this.apiEndpoint;
    return client({
        method: 'put',
        path: parsedUrl.format(),
        headers: {
            Authorization: 'Bearer ' + this.accessToken
        },
        params: params
    })
}

SpotifyStrategy.prototype.get = function(path) {
    return this._get(path);
}

SpotifyStrategy.prototype.getPaginatedList = function(path, itemsParentNode, results) {
    var that = this;
    results = results || [];
    //Seriously Spotify, what a bad Restful architecture!
    //For APIs that returns a list, Spotify returns cursor and next url. In some cases it only work when using cursor. For example: Get User’s Followed Artists!!!
    return this._get(path).then(function(response) {
        var rootNode = itemsParentNode && response.entity.hasOwnProperty(itemsParentNode) ? response.entity[itemsParentNode]: response.entity;
        var items = rootNode.hasOwnProperty('items') ? rootNode.items : [];
        results = results.concat(items);
        if (rootNode.cursors && rootNode.cursors.after) {
            var parsedUrl = URL.parse(path, true);
            parsedUrl.search = null;
            parsedUrl.query.after = rootNode.cursors.after;

            return that.getPaginatedList(parsedUrl.format(), itemsParentNode, results);
        } else if (rootNode.next) {
            var parsedUrl = URL.parse(rootNode.next, true);
            parsedUrl.search = null;

            return that.getPaginatedList(parsedUrl.format(), itemsParentNode, results);
        } else {
            return {
                items: results
            };
        }
    });
}

module.exports = SpotifyStrategy;