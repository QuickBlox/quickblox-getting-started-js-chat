'use strict';

function Dialog() {
    this._cache = {};
    
    this.dialogId = null;
    this.prevDialogId = null;
    this.limit = CONSTANTS.LIMITS.DIALOGS_PER_PAGE;

    // elements
    this.sidebar = null;
    this.content = null;
    this.dialogTitle = null;
    this.dialogsListContainer = null;
    this.messagesContainer = null;
}

Dialog.prototype.init = function () {
    var self = this;

    self.sidebar = document.querySelector('.j-sidebar');
    self.dialogsListContainer = document.querySelector('.j-sidebar__dilog_list');
    self.content = document.querySelector('.j-content');

    self.dialogsListContainer.addEventListener('scroll', function loadMoreDialogs() {
        var container = self.dialogsListContainer,
            position = container.scrollHeight - (container.scrollTop + container.offsetHeight);

        if (container.classList.contains('full')) {
            return false;
        }

        if (position <= 50 && !container.classList.contains('loading')) {
            var type = document.querySelector('.j-sidebar__tab_link.active').dataset.type;
            self.loadDialogs(type);
        }
    });
};

Dialog.prototype.loadDialogs = function (type) {
    var self = this,
        filter = {
            limit: self.limit,
            skip: self.dialogsListContainer.querySelectorAll('.j-dialog__item').length,
            sort_desc: "updated_at"
        };

    return new Promise(function(resolve, reject){
        if (!app.checkInternetConnection()) {
            reject(new Error('no internet connection'));
        }

        self.dialogsListContainer.classList.add('loading');
        filter.type = CONSTANTS.DIALOG_TYPES.CHAT;

        QB.chat.dialog.list(filter, function (err, resDialogs) {
            if (err) {
                reject(err);
            }

            var dialogs = resDialogs.items;

            _.each(dialogs, function (dialog) {
                if (!self._cache[dialog._id]) {
                    self._cache[dialog._id] = helpers.compileDialogParams(dialog);
                }

                self.renderDialog(self._cache[dialog._id]);
            });

            if (self.dialogId) {
                var dialogElem = document.getElementById(self.dialogId);
                if (dialogElem) dialogElem.classList.add('selected');
            }

            if (dialogs.length < self.limit) {
                self.dialogsListContainer.classList.add('full');
            }
            self.dialogsListContainer.classList.remove('loading');

            resolve();
        });
    });
};

Dialog.prototype.renderDialog = function (dialog, setAsFirst) {
    var self = this,
        id = dialog._id,
        elem = document.getElementById(id);

    if(!self._cache[id]){
        self._cache[id] = helpers.compileDialogParams(dialog);
        dialog = self._cache[id];
    }

    if(elem) {
        self.replaceDialogLink(elem);
        return elem;
    }

    if (dialog.type !== CONSTANTS.DIALOG_TYPES.CHAT) return false;

    var template = helpers.fillTemplate('tpl_userConversations', {dialog: dialog});
    elem = helpers.toHtml(template)[0];

    if (!setAsFirst) {
        self.dialogsListContainer.appendChild(elem);
    } else {
        self.dialogsListContainer.insertBefore(elem, self.dialogsListContainer.firstElementChild);
    }

    elem.addEventListener('click', function(e){
        if(e.currentTarget.classList.contains('selected') && app.sidebar.classList.contains('active')){
            app.sidebar.classList.remove('active');
        }
    });

    return elem;
};

Dialog.prototype.selectCurrentDialog = function(dialogId){
    var self = this,
        dialogElem = document.getElementById(dialogId);

    self.sidebar.classList.remove('active');

    if (!app.checkInternetConnection()) {
        return false;
    }

    if (dialogElem.classList.contains('selected') && document.forms.send_message) return false;

    var selectedDialog = document.querySelector('.dialog__item.selected');

    if (selectedDialog) {
        selectedDialog.classList.remove('selected');
    }

    dialogElem.classList.add('selected');
};

Dialog.prototype.decreaseUnreadCounter = function(dialogId){
    var self = this,
        dialog = self._cache[dialogId];

    // Can't decrease unexist dialog or dialog without unread messages.
    if(dialog === undefined || dialog.unread_messages_count <= 0) return;

    dialog.unread_messages_count--;

    var dialogElem = document.getElementById(dialogId),
        unreadCounter = dialogElem.querySelector('.j-dialog_unread_counter');

    unreadCounter.innerText = dialog.unread_messages_count;

    if(dialog.unread_messages_count === 0) {
        unreadCounter.classList.add('hidden');
        unreadCounter.innerText = '';
    }
};

Dialog.prototype.replaceDialogLink = function (elem) {
    var self = this,
        elemsCollection = self.dialogsListContainer.children,
        elemPosition;

    for (var i = 0; i < elemsCollection.length; i++) {
        if (elemsCollection[i] === elem) {
            elemPosition = i;
            break;
        }
    }

    if (elemPosition >= 1) {
        self.dialogsListContainer.insertBefore(elem, self.dialogsListContainer.firstElementChild);
    }
};

Dialog.prototype.renderMessages = function (dialogId) {
    var self = this,
        dialog = self._cache[dialogId];

    document.querySelector('.j-sidebar__create_dialog').classList.remove('active');

    if (!document.forms.send_message) {
        helpers.clearView(this.content);
        self.content.innerHTML = helpers.fillTemplate('tpl_conversationContainer', {title: dialog.name, _id: dialog._id, type: dialog.type});
        self.messagesContainer = document.querySelector('.j-messages');
        self.dialogTitle = document.querySelector('.j-dialog__title');
        
        document.querySelector('.j-open_sidebar').addEventListener('click', function (e) {
            self.sidebar.classList.add('active');
        }.bind(self));

        messageModule.init();
    } else {

        self.dialogTitle.innerText = dialog.name;

        if(dialog.type === CONSTANTS.DIALOG_TYPES.CHAT || dialog.type === CONSTANTS.DIALOG_TYPES.GROUPCHAT) {
            if (dialog && dialog.messages.length) {
                for (var i = 0; i < dialog.messages.length; i++) {
                    if(!dialog.messages[i].selfReaded) {
                        messageModule.sendReadStatus(dialog.messages[i]._id, dialog.messages[i].sender_id, dialogId);
                        dialog.messages[i].selfReaded = true;
                        dialogModule.decreaseUnreadCounter(dialogId);
                    }
                }
            }
        }

        helpers.clearView(self.messagesContainer);
    }

    messageModule.setLoadMoreMessagesListener();

    document.forms.send_message.message_feald.value = dialog.draft.message || '';

    self.checkCachedUsersInDialog(dialogId).then(function(){
        if (dialog && dialog.messages.length) {
            for (var i = 0; i < dialog.messages.length; i++) {
                messageModule.renderMessage(dialog.messages[i], false);
            }

            helpers.scrollTo(self.messagesContainer, 'bottom');

            if (dialog.messages.length < messageModule.limit) {
                messageModule.getMessages(self.dialogId);
            }
        } else {
            messageModule.getMessages(self.dialogId);
        }
    });
};

Dialog.prototype.changeLastMessagePreview = function (dialogId, msg) {
    var self = this,
        dialog = document.getElementById(dialogId),
        message = msg.message;
    
    if (message.indexOf('\n') !== -1) {
        message = message.slice(0, message.indexOf('\n'));
    }

    self._cache[dialogId].last_message = message;
    self._cache[dialogId].last_message_date_sent = msg.date_sent;

    if (dialog) {
        var messagePreview = dialog.querySelector('.j-dialog__last_message ');

        if (msg.message) {
            messagePreview.classList.remove('attachment');
            messagePreview.innerText = message;
        } else {
            messagePreview.classList.add('attachment');
            messagePreview.innerText = 'Attachment';
        }

        dialog.querySelector('.j-dialog__last_message_date').innerText = msg.date_sent;
    }
};

Dialog.prototype.createDialog = function (params) {
    if (!app.checkInternetConnection()) {
        return false;
    }

    var self = this;

    QB.chat.dialog.create(params, function (err, createdDialog) {
        if (err) {
            console.error(err);
        } else {
            var occupants_names = [],
                id = createdDialog._id,
                occupants = createdDialog.occupants_ids,
                message_body = (app.user.name || app.user.login) + ' created new dialog with: ';

            _.each(occupants, function (occupantId) {
                var occupant_name = userModule._cache[occupantId].name || userModule._cache[occupantId].login;

                occupants_names.push(occupant_name);
            });

            message_body += occupants_names.join(', ');

            var systemMessage = {
                extension: {
                    notification_type: 1,
                    dialog_id: createdDialog._id
                }
            };

            var notificationMessage = {
                type: 'groupchat',
                body: message_body,
                extension: {
                    save_to_history: 1,
                    dialog_id: createdDialog._id,
                    notification_type: 1,
                    occupants_ids: occupants.toString()
                }
            };

            var newOccupantsIds = occupants.filter(function(item) {
                return item != app.user.id
            });

            for (var i = 0; i < newOccupantsIds.length; i++) {
                QB.chat.sendSystemMessage(newOccupantsIds[i], systemMessage);
            }

            /* Check dialog in cache */
            if (!self._cache[id]) {
                self._cache[id] = helpers.compileDialogParams(createdDialog);
            }

            self.renderDialog(self._cache[id], true);
            router.navigate('/dialog/' + id);
        }
    });
};

Dialog.prototype.getDialogById = function (id) {
    return new Promise(function(resolve, reject){
        if (!app.checkInternetConnection()) {
            return false;
        }
        QB.chat.dialog.list({"_id": id}, function (err, res) {
            if (err) {
                console.error(err);
                reject(err);
            }

            var dialog = res.items[0];

            if(dialog) {
                resolve(dialog);
            } else {
                reject(new Error('can\'t find dialog with this id: ' + id));
            }
        });
    });
};

Dialog.prototype.checkCachedUsersInDialog = function (dialogId) {
    var self = this,
        userList = self._cache[dialogId].users,
        unsetUsers = [];

    return new Promise(function  (resolve, reject) {
        for (var i = 0; i < userList.length; i++) {
            if (!userModule._cache[userList[i]]) {
                unsetUsers.push(userList[i]);
            }
        }
        if (unsetUsers.length) {
            userModule.getUsersByIds(unsetUsers).then(function(){
                resolve();
            }).catch(function(error){
                reject(error);
            });
        } else {
            resolve();
        }
    });
};

Dialog.prototype.updateDialogUi = function(dialogId, name){
    var self = this,
        cachedDialog = self._cache[dialogId],
        dialogElem = document.getElementById(dialogId);

    cachedDialog.name = name;
    dialogElem.querySelector('.dialog__name').innerText = name;

    if(self.dialogId === dialogId){
        self.dialogTitle.innerText = name;
    }
};

var dialogModule = new Dialog();