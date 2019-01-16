'use strict';

function Login() {
    this.isLoginPageRendered = false;
    this.isLogin = false;
    this.minUserNameAndGroupLength = 3;
    this.maxUserNameAndGroupLength = 15;
}

Login.prototype.isAlphaNumeric = function(str) {
    if(!str.length) return false;

    for(var i = 0; i < str.length; i++) {
        var code = str.charCodeAt(i);
        if (
            code !== 45 && //check for hiphen
            !(code > 47 && code < 58) && // numeric (0-9)
            !(code > 64 && code < 91) && // upper alpha (A-Z)
            !(code > 96 && code < 123) // lower alpha (a-z)
        ) { 
            return false;
        }
    }
    return true;
}

Login.prototype.validateUserNameAndGroup = function(str, type, verbose) {
    var self = this;
    var stringType = type ? type : 'Input';
    if(typeof str === 'string') {
        if(str.length >= self.minUserNameAndGroupLength && str.length <= self.maxUserNameAndGroupLength) {
            if(isNaN(str[0])) {
                if(self.isAlphaNumeric(str)) {
                    return true;
                }else {
                    if(!verbose) alert("Please match the requested format. " + stringType + " Field should contain alphanumeric characters only.");
                    return false;
                }
            }else {
                if(!verbose) alert("Please match the requested format. For the " + stringType + " Field, The first character must be a letter.");
                return false;
            }
        }else {
            if(!verbose) alert("Please match the requested format. " + stringType + " Field should contain alphanumeric characters only in a range 3 to 15.");
            return false;
        }
    }else {
        if(!verbose) alert("Please match the requested format. " + stringType + " Field should contain alphanumeric characters only in a range 3 to 15. The first character must be a letter.");
        return false;
    }
}

Login.prototype.login = function (user) {
    var self = this;
    return new Promise(function(resolve, reject) {
        if(self.isLoginPageRendered) {
            document.forms.loginForm.login_submit.innerText = 'loading...';
        }else {
            self.renderLoadingPage();
        }
        QB.createSession(function(csErr, csRes) {
            var userRequiredParams = {
                'login':user.login,
                'password': user.password
            };
            if (csErr) {
                loginError(csErr);
            }else {
                app.token = csRes.token;
                QB.login(userRequiredParams, function(loginErr, loginUser) {
                    if(loginErr) {
                        /** Login failed, trying to create account */
                        QB.users.create(user, function (createErr, createUser) {
                            if (createErr) {
                                loginError(createErr);
                            }else {
                                QB.login(userRequiredParams, function (reloginErr, reloginUser) {
                                    if (reloginErr) {
                                        loginError(reloginErr);
                                    }else {
                                        loginSuccess(reloginUser);
                                    }
                                });
                            }
                        });
                    }else {
                        /** Update info */
                        if(loginUser.user_tags !== user.tag_list || loginUser.full_name !== user.full_name) {
                            QB.users.update(loginUser.id, {
                                'full_name': user.full_name,
                                'tag_list': user.tag_list
                            }, function(updateError, updateUser) {
                                if(updateError) {
                                    loginError(updateError);
                                }else {
                                    loginSuccess(updateUser);
                                }
                            });
                        }else {
                            loginSuccess(loginUser);
                        }
                    }
                });
            }
        });

        function loginSuccess(userData) {
            app.user = userModule.addToCache(userData);
            app.user.user_tags = userData.user_tags;
            QB.chat.connect({userId: app.user.id, password: user.password}, function(err, roster) {
                if (err) {
                    document.querySelector('.j-login__button').innerText = 'Login';
                    console.error(err);
                    reject(err);
                }else {
                    self.isLogin = true;
                    resolve();
                }
            });
        }

        function loginError(error) {
            self.renderLoginPage();
            console.error(error);
            alert(error + "\n" + error.detail);
            reject(error);
        }
    });
    
};

Login.prototype.renderLoginPage = function() {
    helpers.clearView(app.page);

    app.page.innerHTML = helpers.fillTemplate('tpl_login', {
        version: QB.version + ':' + QB.buildNumber
    });
    this.isLoginPageRendered = true;
    this.setListeners();
};

Login.prototype.setListeners = function() {
    var self = this,
        loginForm = document.forms.loginForm,
        formInputs = [loginForm.userName, loginForm.logIn],
        loginBtn = loginForm.login_submit;

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        if(loginForm.hasAttribute('disabled')) {
            return false;
        }else {
            loginForm.setAttribute('disabled', true);
        }

        var userName = loginForm.userName.value.trim(),
            logIn = loginForm.logIn.value.trim();

        if(!self.validateUserNameAndGroup(userName, 'User Name') || !self.validateUserNameAndGroup(userName, 'Login')) return false;

        var user = {
            login: 'articleSample_' + logIn + '_' + userName,
            password: 'webAppArticlePass',
            full_name: userName,
            tag_list: logIn
        };

        self.login(user).then(function() {
            router.navigate('/dashboard');
        }).catch(function(error) {
            alert('lOGIN ERROR\n open console to get more info');
            loginBtn.removeAttribute('disabled');
            console.error(error);
            loginForm.login_submit.innerText = 'LOGIN';
        });
    });

    // add event listeners for each input;
    _.each(formInputs, function(i) {
        i.addEventListener('focus', function(e) {
            var elem = e.currentTarget,
                container = elem.parentElement;

            if (!container.classList.contains('filled')) {
                container.classList.add('filled');
            }
        });

        i.addEventListener('focusout', function(e) {
            var elem = e.currentTarget,
                container = elem.parentElement;

            if (!elem.value.length && container.classList.contains('filled')) {
                container.classList.remove('filled');
            }
        });

        i.addEventListener('input', function() {
            var userName = loginForm.userName.value.trim(),
                logIn = loginForm.logIn.value.trim();
            if(self.validateUserNameAndGroup(userName, null, true) && self.validateUserNameAndGroup(logIn, null, true)) {
                loginBtn.removeAttribute('disabled');
            }else {
                loginBtn.setAttribute('disabled', true);
            }
        })
    });
};

var loginModule = new Login();
