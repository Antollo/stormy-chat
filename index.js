var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 3000;
var users = {};
var conversatios = {};


app.use(express.static(__dirname + '/public'));
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});


io.on('connection', function (socket) {

    socket.on('login', function (data, callback) {
        if (data in users) {
            callback(false);
        } else {
            callback(true);
            socket.nickname = data;
            users[socket.nickname] = socket;
            socket.join('all');
            if (conversatios['all'] == undefined) conversatios['all'] = [];
            conversatios['all'].push(socket.nickname);
            io.emit('user');
        }
    });

    socket.on('join', function (conversation) {
        socket.join(conversation);
        io.emit('user');
        if (conversatios[conversation] == undefined) conversatios[conversation] = [];
        conversatios[conversation].push(socket.nickname);
    });


    socket.on('chat', function (messageObj) {
        io.to(messageObj.conversation).emit('chat', messageObj);
    });

    socket.on('getusers', function (data) {
        socket.emit('users', conversatios[data]);
    });

    socket.on('disconnect', function (data) {
        delete users[socket.nickname];
        for (var conversation in conversatios) {
            if (conversatios.hasOwnProperty(conversation)) {
                var element = conversatios[conversation];
                var index = element.indexOf(socket.nickname);
                if (index > -1) {
                    element.splice(index, 1);
                    io.to(conversation).emit('user');
                }
            }
        }  
    });
});

http.listen(port, function () {
});