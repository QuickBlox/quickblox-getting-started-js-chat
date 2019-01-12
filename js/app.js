'use strict';
/*
 * Before start chatting you need to follow this steps:
 * 1. Initialize QB SDK ( QB.init() );
 * 2. Create user session (QB.createSession());
 * 3. Connect to the chat in the create session callback (QB.chat.connect());
 * 4. Set listeners;
 */

function App(config) {
    this._config = config;
    this.user = null;
    this.token = null;
    this.room = null;
    // Elements
    this.page = document.querySelector('#page');
    this.sidebar = null;
    this.content = null;
    this.userListConteiner = null;
    this.init(this._config);
    this.loading = true;
}

// Before start working with JS SDK you nead to init it.

App.prototype.init = function (config) {
    // Step 1. QB SDK initialization.
    QB.init(config.credentials.appId, config.credentials.authKey, config.credentials.authSecret, config.appConfig);
};

App.prototype.loadWelcomeTpl = function () {
    
    var content = document.querySelector('.j-content'),
        welcomeTpl = helpers.fillTemplate('tpl_welcome');
    
    console.log(content);
    helpers.clearView(content);
    dialogModule.dialogId = null;
    content.innerHTML = welcomeTpl;
};

App.prototype.renderDashboard = function (activeTabName) {
    var self = this,
        renderParams = {
            user: self.user,
            tabName: ''
        };

    if(activeTabName){
        renderParams.tabName = activeTabName;
    }

    helpers.clearView(app.page);

    self.page.innerHTML = helpers.fillTemplate('tpl_dashboardContainer', renderParams);

    var logoutBtn = document.querySelector('.j-logout');
    loginModule.isLoginPageRendered = false;
    self.content = document.querySelector('.j-content');
    self.sidebar = document.querySelector('.j-sidebar');

    dialogModule.init();

    self.loadWelcomeTpl();

    listeners.setListeners();
};

App.prototype.loadChatList = function () {
    return new Promise(function(resolve, reject){
        helpers.clearView(dialogModule.dialogsListContainer);
        dialogModule.dialogsListContainer.classList.remove('full');

        dialogModule.loadDialogs('chat').then(function(dialogs) {
            resolve(dialogs);
        }).catch(function(error){
            reject(error);
        });
    });
};

App.prototype.buildCreateDialogTpl = function () {
    var self = this,
        createDialogTPL = helpers.fillTemplate('tpl_newChat');
    
    helpers.clearView(self.content);
    
    self.content.innerHTML = createDialogTPL;
    
    var backToDialog = self.content.querySelector('.j-back_to_dialog');
    
    backToDialog.addEventListener('click', self.backToDialog.bind(self));
    
    self.userListConteiner = self.content.querySelector('.j-group_chat__user_list');
    
    document.forms.create_dialog.addEventListener('submit', function (e) {
        e.preventDefault();
        
        if(!self.checkInternetConnection()) return false;
        
        if (document.forms.create_dialog.create_dialog_submit.disabled) return false;

        document.forms.create_dialog.create_dialog_submit.disabled = true;
    
        var users = self.userListConteiner.querySelectorAll('.selected');

        if(users.length > 2) return false;

        var type = CONSTANTS.DIALOG_TYPES.CHAT,
            occupants_ids = [];

        _.each(users, function (user) {
            if (+user.id !== self.user.id) {
                occupants_ids.push(user.id);
            }
        });

        var params = {
            type: type,
            occupants_ids: occupants_ids.join(',')
        };

        dialogModule.createDialog(params);
    });

    userModule.initGettingUsers();
};

App.prototype.backToDialog = function (e) {
    var self = this;
    self.sidebar.classList.add('active');
    document.querySelector('.j-sidebar__create_dialog').classList.remove('active');
    
    if (dialogModule.dialogId) {
        router.navigate('/dialog/' + dialogModule.dialogId);
    } else {
        router.navigate('/dashboard');
    }
};

App.prototype.checkInternetConnection = function () {
    if (!navigator.onLine) {
        alert('No internet connection!');
        return false;
    }
    return true;
};

// QBconfig was loaded from QBconfig.js file
var app = new App(QBconfig);
