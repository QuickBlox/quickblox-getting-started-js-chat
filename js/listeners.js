'use strict';

/**
 * Full user's callbacks (listener-functions) list:
 * - onMessageListener
 * - onMessageErrorListener (messageId, error)
 * - onSentMessageCallback(messageLost, messageSent)
 * - onMessageTypingListener
 * - onDeliveredStatusListener (messageId, dialogId, userId);
 * - onReadStatusListener (messageId, dialogId, userId);
 * - onSystemMessageListener (message)
 * - onContactListListener (userId, type)
 * - onSubscribeListener (userId)
 * - onConfirmSubscribeListener (userId)
 * - onRejectSubscribeListener (userId)
 * - onDisconnectedListener
 * - onReconnectListener
 */


function Listeners() {};

Listeners.prototype.onMessageListener = function (userId, message) {
    if(userId === app.user.id) return false;

    var self = this,
        msg = helpers.fillNewMessageParams(userId, message),
        dialog = dialogModule._cache[message.dialog_id];

    if(message.markable){
        messageModule.sendDeliveredStatus(msg._id, userId, msg.chat_dialog_id);
    }

    if (dialog) {
        dialog.messages.unshift(msg);
        dialogModule.changeLastMessagePreview(msg.chat_dialog_id, msg);

        if(message.extension.notification_type){
            return self.onNotificationMessage(userId, message);
        }
        
        dialogModule.renderDialog(dialog, true);

        if (dialogModule.dialogId === msg.chat_dialog_id) {
            messageModule.renderMessage(msg, true);
        }else {
            dialog.unread_messages_count += 1;
            var dialogElem = document.getElementById(msg.chat_dialog_id),
                counter = dialogElem.querySelector('.j-dialog_unread_counter');

            counter.classList.remove('hidden');
            counter.innerText = dialog.unread_messages_count;
        }
    }else {
        dialogModule.getDialogById(msg.chat_dialog_id).then(function(dialog) {
            dialogModule._cache[dialog._id] = helpers.compileDialogParams(dialog);

            var cachedDialog = dialogModule._cache[dialog._id];
            dialogModule.renderDialog(cachedDialog, true);
        }).catch(function(e){
            console.error(e);
        });
    }
};

Listeners.prototype.onSentMessageCallback = function (messageLost, messageSent) {
    var message = messageSent || messageLost,
        data = {
            _id: message.id,
            dialogId: message.extension.dialog_id
        };

    if (messageLost) {
        // message was not sent to the chat.
        data.status = 'not sent';
    } else {
        // message was sent to the chat but not delivered to che opponent.
        data.status = 'sent';
    }

    messageModule.setMessageStatus(data);
};


Listeners.prototype.onReadStatusListener = function (messageId, dialogId, userId) {
    var data = {
        _id: messageId,
        dialogId: dialogId,
        userId: userId,
        status: 'seen'
    };

    messageModule.setMessageStatus(data);
};

Listeners.prototype.onDeliveredStatusListener = function (messageId, dialogId, userId) {
    var data = {
        _id: messageId,
        dialogId: dialogId,
        userId: userId,
        status: 'delivered'
    };

    messageModule.setMessageStatus(data);
};

Listeners.prototype.setListeners = function () {
    QB.chat.onMessageListener = this.onMessageListener.bind(this);

    // messaage status listeners
    QB.chat.onSentMessageCallback = this.onSentMessageCallback.bind(this);
    QB.chat.onDeliveredStatusListener = this.onDeliveredStatusListener.bind(this);
    QB.chat.onReadStatusListener = this.onReadStatusListener.bind(this);
};

var listeners = new Listeners();
