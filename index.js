var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var port = process.env.PORT || 3000;
var users = {};
var conversations = {};

app.use(express.static(__dirname + "/public"));
app.get("/", function(req, res) {
    res.sendFile(__dirname + "/public/index.html");
});

function addToConversation(nickname, conversationName) {
    if(conversations[conversationName] == undefined) conversations[conversationName] = [];
    if(conversations[conversationName].indexOf(nickname) == -1) conversations[conversationName].push(nickname);
    io.emit("user");
}

io.on("connection", function(socket) {

    socket.on("login", function(nickname, callback) {
        if(nickname in users) callback(false);
        else {
            callback(true);
            socket.nickname = nickname;
            users[nickname] = socket;
            socket.join("all");
            addToConversation(nickname, "all");
        }
    });

    socket.on("join", function(conversationName) {
        socket.join(conversationName);
        addToConversation(socket.nickname, conversationName);
    });


    socket.on("message", function(messageObj) {
        io.to(messageObj.conversation).emit("message", messageObj);
    });

    socket.on("getusers", function(conversationName) {
        socket.emit("users", conversations[conversationName]);
    });

    socket.on("disconnect", function(data) {
        delete users[socket.nickname];
        /*for (var room in rooms) {
            if (rooms.hasOwnProperty(room)) {
                var element = rooms[room];
                var index = element.indexOf(socket.nickname);
                if (index > -1) {
                    element.splice(index, 1);
                    io.to(room).emit('user');
                }
            }
        }*/
    });
});

http.listen(port, function() {
});