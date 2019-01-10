'use strict';

function Message() {
    this.container = null;
    this.limit = CONSTANTS.LIMITS.MESSAGES_PER_PAGE;

    this.dialogTitle = null;
    this._typingTimer = null;
    this._typingTime = null;
    this.typingUsers = {};
}

Message.prototype.init = function () {
    var self = this;
    self.container = document.querySelector('.j-messages');
    self.dialogTitle = document.querySelector('.j-content__title');

    document.forms.send_message.addEventListener('submit', function (e) {
        e.preventDefault();
        self.submitSendMessage(dialogModule.dialogId);
        document.forms.send_message.message_feald.focus();
    });

    document.forms.send_message.message_feald.addEventListener('input', self.checkMessageSymbolsCount.bind(self));
    document.forms.send_message.message_feald.addEventListener('keydown', function (e) {
        var key = e.keyCode;

        if(key === 13) {
            if(!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                e.preventDefault();
                self.submitSendMessage(dialogModule.dialogId);
            }
        }
    });
};

Message.prototype.checkMessageSymbolsCount = function() {
    var messageText = document.forms.send_message.message_feald.value,
        sylmbolsCount = messageText.length;
    if(sylmbolsCount > 1000) {
        document.forms.send_message.message_feald.value = messageText.slice(0, 1000);
    }
};

Message.prototype.submitSendMessage = function (dialogId) {
    if(!app.checkInternetConnection()) {
        return false;
    }

    var self = this,
        dialog = dialogModule._cache[dialogId],
        sendMessageForm = document.forms.send_message,
        msg = {
            type: 'chat',
            body: sendMessageForm.message_feald ? sendMessageForm.message_feald.value.trim() : '',
            extension: {
                save_to_history: 1,
                dialog_id: dialogId
            },
            markable: 1
        };

    if(dialogModule.dialogId === dialogId && sendMessageForm) {
        var dialogElem = document.getElementById(dialogId);

        dialogModule.replaceDialogLink(dialogElem);
        document.forms.send_message.message_feald.value = '';
        dialog.draft.message = null;
    }

    // Don't send empty message
    if(!msg.body) return false;

    self.sendMessage(dialogId, msg);
};

Message.prototype.setLoadMoreMessagesListener = function () {
    var self = this;

    self.container.classList.remove('full');

    if(!self.container.dataset.load) {
        self.container.dataset.load = 'true';
        self.container.addEventListener('scroll', function loadMoreMessages(e) {
            var elem = e.currentTarget,
                dialog = dialogModule._cache[dialogModule.dialogId];

            if(!dialog.full) {
                if(elem.scrollTop < 150 && !elem.classList.contains('loading')) {
                    self.getMessages(dialogModule.dialogId);
                }
            }else {
                elem.removeEventListener('scroll', loadMoreMessages);
                delete self.container.dataset.load;
            }
        });
    }
};

Message.prototype.sendMessage = function(dialogId, msg){
    var self = this,
        message = JSON.parse(JSON.stringify(msg)),
        dialog = dialogModule._cache[dialogId],
        jidOrUserId = dialog.jidOrUserId;

    message.id = QB.chat.send(jidOrUserId, msg);
    message.extension.dialog_id = dialogId;

    var newMessage = helpers.fillNewMessageParams(app.user.id, message);

    dialogModule._cache[dialogId].messages.unshift(newMessage);

    if(dialogModule.dialogId === dialogId) {
        self.renderMessage(newMessage, true);
    }

    dialogModule.changeLastMessagePreview(dialogId, newMessage);
};

Message.prototype.getMessages = function (dialogId) {
    if(!navigator.onLine) return false;

    var self = this,
        params = {
            chat_dialog_id: dialogId,
            sort_desc: 'date_sent',
            limit: self.limit,
            skip: dialogModule._cache[dialogId].messages.length,
            mark_as_read: 0
        };

    self.container.classList.add('loading');

    QB.chat.message.list(params, function (err, messages) {
        if(messages) {
            var dialog = dialogModule._cache[dialogId];
            dialog.messages = dialog.messages.concat(messages.items);
            
            if(messages.items.length < self.limit) {
                dialog.full = true;
            }
            if(dialogModule.dialogId !== dialogId) return false;

            if(dialogModule._cache[dialogId].type === 1) {
                console.log('Public Dialog');
            }else {
                for (var i = 0; i < messages.items.length; i++) {
                    var message = helpers.fillMessagePrams(messages.items[i]);

                    self.renderMessage(message, false);
                }

                if(!params.skip) {
                    helpers.scrollTo(self.container, 'bottom');
                }
            }
        }else {
            console.error(err);
        }

        self.container.classList.remove('loading');
    });
};

Message.prototype.sendDeliveredStatus = function(messageId, userId, dialogId){
    var params = {
        messageId: messageId,
        userId: userId,
        dialogId: dialogId
    };

    QB.chat.sendDeliveredStatus(params);

};

Message.prototype.sendReadStatus = function(messageId, userId, dialogId){
    var params = {
        messageId: messageId,
        userId: userId,
        dialogId: dialogId
    };

    QB.chat.sendReadStatus(params);
};

Message.prototype.renderMessage = function (message, setAsFirst) {
    var self = this,
        sender = userModule._cache[message.sender_id],
        dialogId = message.chat_dialog_id,
        messagesHtml,
        messageText;

    if(!message.selfReaded){
        self.sendReadStatus(message._id, message.sender_id, dialogId);
        message.selfReaded = true;
        dialogModule.decreaseUnreadCounter(dialogId);
    }

    if(message.notification_type || (message.extension && message.extension.notification_type)) {
        console.log('Notification Message', {
            id: message._id,
            text: messageText
        });
    }else {
        messageText = message.message ? helpers.fillMessageBody(message.message || '') : helpers.fillMessageBody(message.body || '');
        messagesHtml = helpers.fillTemplate('tpl_message', {
            message: {
                status: message.status,
                id: message._id,
                sender_id: message.sender_id,
                message: messageText,
                attachments: message.attachments,
                date_sent: message.date_sent
            },
            yourMsg: sender.id === app.user.id,
            sender: sender});
    }

    var elem = helpers.toHtml(messagesHtml)[0];

    if(!sender) {
        userModule.getUsersByIds([message.sender_id], function (err) {
            if(!err) {
                sender = userModule._cache[message.sender_id];

                var userIcon = elem.querySelector('.message__avatar'),
                    userName = elem.querySelector('.message__sender_name');

                userIcon.classList.remove('m-user__img_not_loaded');
                userIcon.classList.add('m-user__img_' + sender.color);
                userName.innerText = sender.name;
            }
        });
    }

    if(setAsFirst) {
        var scrollPosition = self.container.scrollHeight - (self.container.offsetHeight + self.container.scrollTop),
            typingElem = document.querySelector('.j-istyping');

        if(typingElem) {
            self.container.insertBefore(elem, typingElem);
        }else {
            self.container.appendChild(elem);
        }

        if(scrollPosition < 50) {
            helpers.scrollTo(self.container, 'bottom');
        }
    }else {
        var containerHeightBeforeAppend = self.container.scrollHeight - self.container.scrollTop;

        self.container.insertBefore(elem, self.container.firstElementChild);

        var containerHeightAfterAppend = self.container.scrollHeight - self.container.scrollTop;

        if(containerHeightBeforeAppend !== containerHeightAfterAppend) {
            self.container.scrollTop += containerHeightAfterAppend - containerHeightBeforeAppend;
        }
    }
};

Message.prototype.setMessageStatus = function(data) {
    var dialogId = data.dialogId,
        status = data.status,
        messageId = data._id,
        dialog = dialogModule._cache[dialogId];

    // Dialog with this ID was not founded in the cache
    if(dialog === undefined) return;

    var message = dialog.messages.find(function(message){
        if(message._id === messageId) return true;
    });

    // if the message was not fined in cache or it was notification message, DO NOTHING
    if(message === undefined || message.notification_type !== undefined) return;

    // if the same status is coming DO NOTHING
    if(message.status === status) return;

    message.status = status;

    if(dialogId === dialogModule.dialogId){
        var messageElem = document.getElementById(messageId);

        if(messageElem !== undefined){
            var statusElem = messageElem.querySelector('.j-message__status');

            statusElem.innerText = status;
        }
    }
};

var messageModule = new Message();
