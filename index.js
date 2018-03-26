var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var url = process.env.MONGOLAB_URI;
console.log(url);

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var cheerio = require('cheerio')
var $ = cheerio.load('');
var port = process.env.PORT || 3000;
var users = {};
var conversations = {};


app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});


io.on('connection', function (socket) {

    socket.on('login', function (data, callback) {
        data.nickname = $("<div>").html(data.nickname).text();
        data.password = $("<div>").html(data.password).text();
        if (data.nickname in users) {
            //Already logged.
            console.log('User ' + data.nickname + ' tried to login in 2 windows.');
            callback(0);
        } else {
            MongoClient.connect(url, function (err, db) {
                if (err) throw err;
                var dbo = db.db('stormy-chat');
                dbo.collection('users').find({nickname: data.nickname}).toArray(function(err, result) {
                    if (err) throw err;
                    if(result.length != 0) {
                        if(result[0].password == data.password)
                        {
                            //Succesfull login.
                            callback(1);
                            socket.nickname = data.nickname;
                            users[socket.nickname] = socket;
                            socket.join('all');
                            if (conversations['all'] == undefined) conversations['all'] = [];
                            conversations['all'].push(socket.nickname);
                            io.emit('user');

                            socket.emit('join', result[0].conversations);
                            console.log('User ' + data.nickname + ' logged succesfully.');
                        }
                        else
                        {
                            //Wrong password.
                            console.log('User ' + data.nickname + ' passed in wrong password.');
                            callback(2);
                        }
                        db.close();
                    } else {
                        //First login.
                        dbo.collection('users').insertOne({nickname: data.nickname, password: data.password, conversations: ['all']}, function(err, res) {
                            if (err) throw err;
                            callback(1);
                            socket.nickname = data.nickname;
                            users[socket.nickname] = socket;
                            socket.join('all');
                            if (conversations['all'] == undefined) conversations['all'] = [];
                            conversations['all'].push(socket.nickname);
                            io.emit('user');

                            socket.emit('join', ['all']);
                            console.log('User ' + data.nickname + ' logged succesfully.');
                            db.close();
                        });
                    }
                });
            });
        }
    });

    socket.on('join', function (conversation) {
        //conversation = $("<div>").html(conversation).text();
        socket.join(conversation);
        io.emit('user');
        if (conversations[conversation] == undefined) conversations[conversation] = [];
        if(conversations[conversation].indexOf(socket.nickname) == -1) conversations[conversation].push(socket.nickname);
        MongoClient.connect(url, function (err, db) {
            if (err) throw err;
            var dbo = db.db('stormy-chat');
            dbo.collection('users').findOne({nickname: socket.nickname}, function(err, result) {
                if (err) throw err;
                if(result.conversations.indexOf(conversation) == -1) {
                    result.conversations.push(conversation);
                    dbo.collection('users').updateOne({nickname: socket.nickname}, {$set: result}, function(err, res) {
                        if (err) throw err;
                        console.log('User ' + socket.nickname + ' joined ' + conversation + '.');
                        dbo.listCollections().toArray(function(err, collections) {
                            var add = true;
                            collections.forEach(function(coll) {
                                if(coll.name == conversation) add = false;
                            });
                            if(add) {
                                dbo.createCollection(conversation, function(err, res) {
                                    if (err) throw err;
                                    console.log(conversation + ' created.');
                                    db.close();
                                });
                            } else {
                                db.close();
                            }
                        });
                    });
                } else {
                    dbo.listCollections().toArray(function(err, collections) {
                        var add = true;
                        collections.forEach(function(coll) {
                            if(coll.name == conversation) add = false;
                        });
                        if(add) {
                            dbo.createCollection(conversation, function(err, res) {
                                if (err) throw err;
                                console.log(conversation + ' created.');
                                db.close();
                            });
                        } else {
                            db.close();
                        }
                    });
                }
            });
        });
    });

    socket.on('exit', function (conversation) {
        conversation = $("<div>").html(conversation).text();
        socket.leave(conversation);
        io.emit('user');
        if(conversations[conversation].indexOf(socket.nickname) != -1) conversations[conversation].splice(conversations[conversation].indexOf(socket.nickname), 1);
        MongoClient.connect(url, function (err, db) {
            if (err) throw err;
            var dbo = db.db('stormy-chat');
            dbo.collection('users').findOne({nickname: socket.nickname}, function(err, result) {
                if (err) throw err;
                if(result.conversations.indexOf(conversation) != -1) {
                    result.conversations.splice(result.conversations.indexOf(conversation), 1);
                    dbo.collection('users').updateOne({nickname: socket.nickname}, {$set: result}, function(err, res) {
                        if (err) throw err;
                        console.log('User ' + socket.nickname + ' exited ' + conversation + '.');
                    });
                }
            });
        });
    });


    socket.on('chat', function (messageObj) {
        if(messageObj.text != undefined) {
            messageObj.text = $("<div>").html(messageObj.text).text();
            if(messageObj.text.length == 0) return;
        }
        if(messageObj.image != undefined) {
            messageObj.image = $("<div>").html(messageObj.image).text();
        }   
        messageObj.user = $("<div>").html(messageObj.user).text();
        messageObj.conversation = $("<div>").html(messageObj.conversation).text();
        io.to(messageObj.conversation).emit('chat', messageObj);
        MongoClient.connect(url, function (err, db) {
            if (err) throw err;
            var dbo = db.db('stormy-chat');
            dbo.collection(messageObj.conversation).insertOne(messageObj, function(err, res) {
                if (err) throw err;
                console.log(messageObj);
                db.close();
            });
        });
    });

    socket.on('getusers', function (conversation) {
        //conversation = $("<div>").html(conversation).text();
        socket.emit('users', conversations[conversation]);
    });

    socket.on('gethistory', function (conversation) {
        //conversation = $("<div>").html(conversation).text();
        MongoClient.connect(url, function (err, db) {
            if (err) throw err;
            var dbo = db.db('stormy-chat');
            dbo.collection(conversation).find({}, {limit: 1000}).toArray(function(err, result) {
                if (err) throw err;
                result.forEach(function(message) {
                    socket.emit('chat', message);
                });
                db.close();
              });
        });
    });

    socket.on('disconnect', function (data) {
        delete users[socket.nickname];
        for (var conversation in conversations) {
            if (conversations.hasOwnProperty(conversation)) {
                var index = conversations[conversation].indexOf(socket.nickname);
                while (index > -1) {
                    conversations[conversation].splice(index, 1);
                    index = conversations[conversation].indexOf(socket.nickname);
                }
                console.log(conversations)
                io.to(conversation).emit('user');
            }
        } 
        console.log('User ' + socket.nickname + ' disconnected.');
    });
});

http.listen(port, function () {
});