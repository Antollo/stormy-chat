$(document).ready(function () {

    var socket = io(); //Socket instance

    var $chatWindow = $('#chat'); //Chat window div
    var $loginWindow = $('#login'); //Login window div
    var $loadingWindow = $('#loading'); //Loading window div
    var $addChannelWindow = $('#channel'); //Add channel window (dialog) div

    var $sendMessageForm = $('#send-message-form'); //Form for sending messages
    var $sendMessageFormInput = $('#send-message-form-input'); //Textfield for message input
    var $sendMessageButton = $('#send-message-button'); //Button for sending message
    var $sendImageButton = $('#send-image-button'); //Button for sending image

    var $loginForm = $('#login-form'); //Form for adding username
    var $loginNicknameInput = $('#login-nickname'); //Textfield for nickname input
    var $loginPasswordInput = $('#login-password'); //Textfield for password input
    var $loginButton = $('#login-button'); //Button for logging in
    var $exitChannelButton = $('#exit-channel-button'); //Button for exiting button

    var $addChannelForm = $('#add-channel-form'); //Form for adding channel
    var $addChannelFormInput = $('#add-channel-form-input'); //Textfield for channel name input
    var $addChannelButton = $('#add-channel-form-button'); //Button for adding channel
    var $closeChannelButton = $('#close-channel-form-button'); //Button for adding channel

    var $addChannelFab = $('#add-channel-button'); //FAB button for opening add-channel-form

    var $channelsList = $('#channel-list'); //List of channels in navigation drawer
    var currentChannel = 'all'; //Current channel
    
    var nickname = '';


    //Send message form triggers
    $sendMessageButton.click(function () {
        sendMessage();
        return false;
    });
    $sendMessageForm.submit(function () {
        sendMessage();
        return false;
    });
    $(document).on('change', '#send-image-button', function () {
        for(var i = 0; i < $sendImageButton.prop('files').length; i++) {
            var reader = new FileReader();
            reader.onloadend = function() {
                sendImage(reader.result);
            }
            reader.readAsDataURL($sendImageButton.prop('files')[i]);
        }
    });

    //Login form triggers
    $loginButton.click(function () {
        login();
        return false;
    });
    $loginForm.submit(function () {
        login();
        return false;
    });

    //Add new channel triggers
    $addChannelButton.click(function () {
        $addChannelWindow.get(0).close();
        $addChannelWindow.hide();
        addNewChannel($addChannelFormInput.val());
        return false;
    });

    $closeChannelButton.click(function () {
        $addChannelWindow.get(0).close();
        $addChannelWindow.hide();
    });
    $addChannelForm.submit(function () {
        $addChannelWindow.get(0).close();
        $addChannelWindow.hide();
        addNewChannel($addChannelFormInput.val());
        return false;
    });

    //Open add new channel dialog
    $addChannelFab.click(function () {
        $loginWindow.hide();
        //$chatWindow.hide();
        
        $addChannelWindow.get(0).showModal();
        $addChannelWindow.show();
    });

    //Track the click of channel in the drawer
    $channelsList.click(function (e) {
        if (e.target.tagName === 'A' && e.target.id.substring(0, 7) === 'channel') {
            var channelName = e.target.id.substring(8);
            loadChannel(channelName);
        }
    });

    $exitChannelButton.click(function () {
        var currentroom = '';
        $('#chat-cell').children('div').each(function () {
            if ($(this).is(":visible")) {
                currentroom = $(this).prop('id').substring(10);
            }
        });
        socket.emit('exit', currentroom);
        location.reload();
    })

    //SOCKET FUNCTIONS
    //Server sends list of users
    socket.on('users', function (data) {
        $('#users').html('');

        //Loop through the users
        for (i = 0; i < data.length; i++) {
            var listItem = $('<li class="user-list-item mdl-list__item">');
            var mainSpan = $('<span class="mdl-list__item-primary-content"></span>');
            mainSpan.append('<i class="material-icons mdl-list__item-icon">person</i>' + data[i]);
            listItem.append(mainSpan);
            $('#users').append(listItem);
        }
    });
    //Server sends a new message
    socket.on('chat', function (messageObj) {

        //Calculate time
        var date = new Date();
        date.setTime(messageObj.date);

        //Create new message
        var listItem = $('<li class="mdl-list__item mdl non-flex"></li>');
        var mainSpan = $('<div></div>');
        var icon = $('<i class="material-icons mdl-list__item-avatar">person</i>');
        //var user = $('<div class="small-text"></div>').text(messageObj.user);
        var message = $('<div class="bubble"></div>');
        if(messageObj.text != undefined) {
            message.text(messageObj.text);
        } else {
            message.append($('<img src=' + messageObj.image + '>').css('max-width','100%'));
        }
        //message.style.whiteSpace = "pre";
        var time = $('<div class="small-text"></div>').text(messageObj.user + ', ' + date.toLocaleString());

        if(messageObj.user == nickname) 
        {
            mainSpan.css('float', 'right');
            message.addClass('mdl-color--indigo-A200')
        }
        else
        {
            mainSpan.css('float', 'left');
            message.addClass('mdl-color--amber-500')
        }
        //Build the message html and append it to the correct room div
        //mainSpan.append(icon);
        //mainSpan.append(user);
        mainSpan.append(message);
        mainSpan.append(time);
        listItem.append(mainSpan);
        $('#messages-' + messageObj.conversation).append(listItem);

        //Scroll down
        $('#chat-list-' + messageObj.conversation).animate({ scrollTop: $('#chat-list-' + messageObj.conversation).prop("scrollHeight") }, 100);
    });

    //Server sends
    socket.on('user', function () {

        $('#chat-cell').children('div').each(function () {
            if ($(this).is(":visible")) {
                socket.emit('getusers', $(this).prop('id').substring(10));
            }
        });
    });

    socket.on('join', function (data) {
        data.forEach(function(name) {
            addNewChannel(name);
        });
    });

    //LOCALFUNCTIONS
    //Load channel which is already joined
    function loadChannel(name) {
        $('#chat-cell').children('div').each(function () {
            if ($(this).prop('id').substring(10) == name) {
                $(this).show();
            } else {
                $(this).hide();
            }
        });
        socket.emit('getusers', name);       
        currentChannel = name;
        $('#header-title').text(name);
        $('#chat-list-' + name).animate({ scrollTop: $('#chat-list-' + name).prop("scrollHeight") }, 500);

    }

    //Create/Join new channel
    function addNewChannel(newChannelName) {
        newChannelName = newChannelName.trim().toLowerCase().replace(/\s/g,'').replace(/"/g,'');
        var alreadyJoined = false;
        $('#chat-cell').children('div').each(function () {
            if ($(this).prop('id').substring(10) == newChannelName) {
                alreadyJoined = true;
            }
        });
        if (!alreadyJoined) {
            var channelLink = $('<a class="mdl-navigation__link drawer-button" id="channel-' + newChannelName + '" onclick="document.getElementById(`chat-layout`).MaterialLayout.hideDrawer()"></a>');
            channelLink.text(newChannelName);
            $channelsList.prepend(channelLink);
            $addChannelFormInput.val('');
            $loginWindow.hide();
            $chatWindow.show();
            $addChannelWindow.hide();
            createChannelDiv(newChannelName);
            socket.emit('join', newChannelName);
            loadChannel(newChannelName);
            socket.emit('gethistory', newChannelName); 
        } else {
            $addChannelFormInput.val('');
            $loginWindow.hide();
            $chatWindow.show();
            $addChannelWindow.hide();
            loadChannel(newChannelName);   
        }
    }
    //Create "window" for new channel
    function createChannelDiv(name) {
        var newChannelDiv = $('<div class="chat-list-div" id="chat-list-' + name + '"></div>');
        var messagesList = $('<ul class="listborder mdl-list" id="messages-' + name + '"></ul>');
        newChannelDiv.append(messagesList);
        $('#chat-cell').append(newChannelDiv);

    }
    
    function login() {
        nickname = $loginNicknameInput.val();
        $('#drawer-title').text($loginNicknameInput.val());
        socket.emit('login', {nickname: $loginNicknameInput.val(), password: $loginPasswordInput.val()}, function (res) {
            if (res == 1) {
                Cookies.set('nickname', $loginNicknameInput.val());
                Cookies.set('password', $loginPasswordInput.val());
                $loadingWindow.hide()
                $loginWindow.hide();
                $chatWindow.show();
            } else {
                $loadingWindow.hide()
                $loginWindow.show();
                if(res == 0) {
                    $(".mdl-js-snackbar").get(0).MaterialSnackbar.showSnackbar({message: 'User ' + $loginNicknameInput.val() + ' already logged in.'});
                } else {
                    $(".mdl-js-snackbar").get(0).MaterialSnackbar.showSnackbar({message: 'Wrong password.'});
                }
            }
            $loginNicknameInput.parent().get(0).MaterialTextfield.change('');
            $loginPasswordInput.parent().get(0).MaterialTextfield.change('');
        });

    }



    //Send message
    function sendMessage() {
        var currentroom = '';
        $('#chat-cell').children('div').each(function () {
            if ($(this).is(":visible")) {
                currentroom = $(this).prop('id').substring(10);
            }
        });
        socket.emit('chat', { text: $sendMessageFormInput.val(), user: nickname, conversation: currentroom, date: new Date().getTime()});
        $sendMessageFormInput.parent().get(0).MaterialTextfield.change('');
    }

    function sendImage(base64) {
        var currentroom = '';
        $('#chat-cell').children('div').each(function () {
            if ($(this).is(":visible")) {
                currentroom = $(this).prop('id').substring(10);
            }
        });
        socket.emit('chat', { image: base64, user: nickname, conversation: currentroom, date: new Date().getTime()});
    }
    var loadingCounter = 0;
    $('.mdl-layout').on('mdl-componentupgraded', function(e) {
        if ($(e.target).hasClass('mdl-layout')) {
            loadingCounter++;
            if(loadingCounter != 3) return;
            if(Cookies.get('nickname') != undefined) {
                $loginNicknameInput.val(Cookies.get('nickname'));
                $loginPasswordInput.val(Cookies.get('password'));
                login();
            }
            else
            {
                $loadingWindow.hide();
                $loginWindow.show();
            }
            document.getElementById(`chat-layout`).MaterialLayout.hideDrawer = function () {
                var drawerButton = this.element_.querySelector('.' + this.CssClasses_.DRAWER_BTN);
                // Set accessibility properties.
                if (this.drawer_.classList.contains(this.CssClasses_.IS_DRAWER_OPEN)) {
                    this.drawer_.classList.toggle(this.CssClasses_.IS_DRAWER_OPEN);
                    this.obfuscator_.classList.toggle(this.CssClasses_.IS_DRAWER_OPEN);
                    this.drawer_.setAttribute('aria-hidden', 'true');
                    drawerButton.setAttribute('aria-expanded', 'false');
                }
            };
            var dialog = $addChannelWindow.get(0);
            if (! dialog.showModal) {
                dialogPolyfill.registerDialog(dialog);
            }
        }
    });
});