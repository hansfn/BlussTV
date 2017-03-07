// Hack, get game-code from url:
var m = window.location.pathname.match(/^\/game\/([^\/]+)/);
var gameCode = null;
if (m) {
    gameCode = m[1];
}

// Setup a socket to send if no caspar:
var socket = io.connect("/");

angular.module('services', [])
    .factory('GameService', ['$http', '$q', function ($http, $q) {


        var scoreBoardUpdateTime = 20;
        var game = null;

        var currentScore = {};

        var f = {};

        var createGameId = function () {
            var text = "";
            var possible = "abcdefghijklmnopqrstuvwxyz0123456789";

            for( var i=0; i < 5; i++ )
                text += possible.charAt(Math.floor(Math.random() * possible.length));

            return text;
        };

        var updateScore = function () {
            if (!game) {
                setTimeout(updateScore, scoreBoardUpdateTime*1000);
                return;
            }

            $http({
                method: 'GET',
                url: '/update-score',
                params: {url: game.url}
            }).then(function (response) {
                var score = response.data;

                if (!Object.equals(score, currentScore)) {
                    currentScore = score;

                    notifyObservers('score-update');
                }

                setTimeout(updateScore, scoreBoardUpdateTime*1000);
            }, function () {
                setTimeout(updateScore, scoreBoardUpdateTime*1000);
            });

        }

        setTimeout(updateScore, 5000);

        var observerCallbacks = [];
        var f = {};
        //register an observer
        f.registerObserverCallback = function(type, callback){
            if (typeof type === 'string') {
                type = [type];
            }
            for (var i in type) {
                observerCallbacks.push({type: type[i], callback: callback});
            }
        };

        //call this when you know 'foo' has been changed
        var notifyObservers = function(type, data) {
            angular.forEach(observerCallbacks, function(observer) {
                if (observer.type == type) {
                    observer.callback(type, data);
                }
            });
        };


        f.getCurrentScore = function () {
            return currentScore;
        };

        // Dummy functions:
        f.createNewGame = function (options) {
            var deferred = $q.defer();
            game = null;

            if (options && options.poengLigaGameUrl) {
                f.getGameInfo(options.poengLigaGameUrl).then ( function () {
                    game = response.data;
                    game.url = gameUrl;
                    game.gameCode = createGameId();
                    deferred.resolve(game);
                    f.saveChanges(game);
                });
                return;
            }
            else {
                // Normal game:
                gameDefaults = {
                    gameCode: createGameId(),
                    homeTeam: {
                        name: '',
                        logo: '',
                        players: []
                    },
                    awayTeam: {
                        name: '',
                        logo: '',
                        players: []
                    }
                };

                game = {}
                angular.extend(game, gameDefaults, options);
                f.saveChanges(game);
                deferred.resolve(game);
            }
            return deferred.promise;;
        }


        f.getGameInfo = function (gameUrl) {
            var deferred = $q.defer();

            if (game) {
                deferred.resolve(game);
                return deferred.promise;
            }

            if (!gameUrl && game) {
                gameUrl = game.url;
            }
            else if (!gameUrl && !game) {
                gameUrl = 'http://www.poengliga.no/eliteh/1617/kamper/9web.html';
            }

            $http({
                method: 'GET',
                url: '/game-info',
                params: {url: gameUrl}
            }).then(function (response) {


                deferred.resolve(response.data);

                notifyObservers('game-info');

                // HACK HACK HACK, just reload the page to get the new info :D
                document.location.reload();


            }, function (err) {
                deferred.reject(err);
            });

            return deferred.promise;
        };

        f.getTeamName = function (team) {
            if (!game) {
                return;
            }
            if (team == 'home') {
                return game.homeTeam.name;
            }
            else {
                return game.awayTeam.name;
            }
        };

        f.getTeam = function (team) {
            if (!game) {
                return;
            }
            if (team == 'home') {
                return game.homeTeam;
            }
            else {
                return game.awayTeam;
            }
        }

        f.getPlayerByNumber = function (team, number) {
            if (!game) {
                return;
            }
            if (team == 'home') {
                players = game.homeTeam.players;
            }
            else {
                players = game.awayTeam.players;
            }

            for (var i in players) {
                if (players[i].number == number) {
                    return players[i];
                }
            }
            return null;
        };

        f.saveChanges = function (g) {
            game = g;

            f.setStoredValue('game', game);
        };


        f.getStoredValue = function (key) {
            var item = localStorage.getItem(key);
            if (!item) {
                return null;
            }
            return JSON.parse(item);
        };

        f.setStoredValue = function (key, value) {
            localStorage.setItem(key, JSON.stringify(value));
        };

        game = f.getStoredValue('game');

        return f;

    }])

    .factory('CasparCGService', ['$http', '$q', function ($http, $q) {
        var f = {};
        var currentOverlay = "";

        var tvWindow = null;
        var hasCaspar = false;


        var getPreviewWindow = function (url) {
            var deferred = $q.defer();
                if ((tvWindow == null) || (tvWindow.closed)  )
                {
                    tvWindow = window.open(url,'TV','height=720,width=1280');
                    tvWindow.addEventListener('load', function () {

                        tvWindow.getOnWebSocketConnect( function () {
                            deferred.resolve(tvWindow);
                        });
                    }, true);

                }
            else {
                    console.log('No reload needed');
                    deferred.resolve(tvWindow);
                }

            return deferred.promise;

        }

        var updateWindow = function (template, action, data) {
            // Send as a websocket message:
            socket.send(JSON.stringify({gameCode: gameCode, template: template, action: action, data: {data: data}}));
        }

        var observerCallbacks = [];
        var f = {};

        f.getHtmlOverlayUrl = function () {
            return window.location.protocol + '//' + window.location.host + '/game/' + gameCode + '/overlay';
        }

        //register an observer
        f.registerObserverCallback = function(type, callback){
            if (typeof type === 'string') {
                type = [type];
            }
            for (var i in type) {
                console.log(type[i]);
                observerCallbacks.push({type: type[i], callback: callback});
            }
        };

        //call this when you know 'foo' has been changed
        var notifyObservers = function(type, data) {
            console.log('Letting you know of ' + type);
            angular.forEach(observerCallbacks, function(observer) {
                if (observer.type == type) {
                    console.log('Letting people know of ' + type);
                    observer.callback(type, data);
                }
            });
        };

        f.playStream = function (stream) {
            $.post('/caspar/play-stream/', {stream: stream}, function () {
            });
        }

        f.runOverlay = function (template, data) {
            console.log(data);


            if (currentOverlay) {
                currentOverlay = template;

                if (hasCaspar) {
                    // Give the current overlay a chance to exit:
                    $.post('/caspar/templates/' + template + '/remove', {}, function () {
                        $.post('/caspar/templates/' + template + '/play', {data: data}, function () {

                        });
                    });
                }
                else {
                    getPreviewWindow('/game/' + gameCode + '/overlay').then ( function () {
                        updateWindow(template, 'remove', data);
                        updateWindow(template, 'play', data);
                    });
                }
            }
            else {

                currentOverlay = template;

                if (hasCaspar) {
                    $.post('/caspar/templates/' + template + '/play', {data: data}, function () {

                    });
                }
                else {
                    console.log(data);
                     getPreviewWindow('/game/' + gameCode + '/overlay').then ( function (w) {
                        updateWindow(template, 'play', data);
                    });
                }
            }

            notifyObservers('overlay-play', {template: template});

        }

        f.removeOverlay = function (template, data) {
            currentOverlay = "";
            if (hasCaspar) {
                $.post('/caspar/templates/' + template + '/remove', {data: data}, function () {
                });
            }
            else {
                console.log(data);
                getPreviewWindow('/game/' + gameCode + '/overlay').then ( function (w) {
                    updateWindow(template, 'remove', data);
                });
            }

            notifyObservers('overlay-remove');
        }

        f.updateOverlay = function (template, data) {
            if (template != currentOverlay) {
                return;
            }

            if (hasCaspar) {
                $.post('/caspar/templates/' + template + '/update', {data: data}, function () {
                });
            }
            else {
                getPreviewWindow('/game/' + gameCode + '/overlay').then ( function (w) {
                    updateWindow(template, 'update', data);
                });
            }
        }

        f.getCurrentOverlay = function () {
            return currentOverlay;
        }

        return f;
    }]);




