'use strict';

var router = new Navigo(null, true, '#!');

router.on({
    '': function() {
        if(!loginModule.isLogin) {
            router.navigate('/login');
        }else {
            router.navigate('/dashboard');
        }
    },
    '/login': function() {
        loginModule.renderLoginPage();
    },
    '/dashboard': function() {
        if(!loginModule.isLogin) {
            router.navigate('/login');
        }else {
            app.renderDashboard('chat');
            dialogModule.loadDialogs('chat');
        }
    },
    '/dialog/create': function() {
        if(!loginModule.isLogin){
            router.navigate('/login');
        }else {
            _renderNewDialogTmp();
        }

        function _renderNewDialogTmp(){
            var createDialogTab = document.querySelector('.j-sidebar__create_dialog');

            createDialogTab.classList.add('active');
            app.sidebar.classList.remove('active');

            app.buildCreateDialogTpl();
        }
    },
    '/dialog/:dialogId': function(params){
        var dialogId = params.dialogId;

        dialogModule.prevDialogId = dialogModule.dialogId;
        dialogModule.dialogId = dialogId;

        if (!loginModule.isLogin){
            router.navigate('/login');
        } else {
            _renderSelectedDialog();
        }

        function _renderSelectedDialog(){
            var currentDialog = dialogModule._cache[dialogId];
            if(!currentDialog){
                dialogModule.getDialogById(dialogId).then(function(dialog) {
                    app.loadChatList().then(function() {
                        dialogModule.renderMessages(dialogId);
                        app.sidebar.classList.remove('active');
                    }).catch(function(error){
                        console.error(error);
                    });

                }).catch(function(error){
                    console.error(error);
                    app.loadChatList();
                    router.navigate('/dashboard');
                });
            }else {
                dialogModule.renderMessages(dialogId);
                dialogModule.selectCurrentDialog(dialogId);
            }
        }
    },
}).resolve();

router.notFound(function() {
   alert('can\'t find this page');
});