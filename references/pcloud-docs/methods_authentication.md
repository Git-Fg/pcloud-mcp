# pCloud docs: methods/intro/authentication.html

> Source: https://docs.pcloud.com/methods/intro/authentication.html

# Authentication

Many of pCloud API methods require authentication.\
\
This means that these methods are oriented to changing the information and data that given user owns and is about him / her. To identify who is exactly the user whose details are changed, the following protocol is used.\
\

## Tokens

To call a given method that require authentication, the current user has to be identified.\
\
This happens with tokens - strings that are generated every time, when the user is logged in. It is provided that these tokens are unique for thier owner at a given moment.\
\
Auth tokens are at most 64 bytes long and can be passed back instead of username/password credentials. Tokens is especially good for setting the auth cookie to keep the user logged in.\
\
To pass these tokens to the API, use the parameter auth\
\
So for example a call to a method that needs authentication will look like: https://api.pcloud.com/{METHOD_NAME}?auth={AUTHENTICATION_TOKEN}&{METHOD_PARAMETRS}

## Token Expiration

The authentication tokens have period in which they are available to be used. After this period they will not be longer active. This field of the tokens is a datetime, called expire.\
\
There is also a mechanism to make sure that the owner of the token is using it. The token will expire if it is not used for some period. This field is a datetime, called expire_inactive. This field increments every time the token is used on the server.\
\
The expiration information of all token of the current user could be received using the method [listtoken](/methods/auth/listtoken.html).

## Login

Login is the moment, when a token for given user is generated and then returned to the using the API application.\
\
The login parameters are [global](/methods/intro/global_parameters.html) - they could be passed to every method, so they are not described. This means that every method could be used as login point and there is no method called login\
\
However, a good point for login is [userinfo](/methods/general/userinfo.html) method, with which information about the user, will be returned after successful login.\
\
To receive auth tokens, the parameter getauth must be set to any value and upon successful authentication an auth token will be returned.\
\
The expiration and expiration_inactive values for the token that is being obtained could be set using the global parameters [authexpire](/methods/intro/global_parameters.html) and [authinactiveexpire](/methods/intro/global_parameters.html). They are in seconds that are being added to the current moment, to calculate the values for the token.\
\
To identify the device that is requesting the authorization, use the global parameter [device](/methods/intro/global_parameters.html). This parameter is required for the binary protocol and defaults to the HTTP header *User-Agent*, if the HTTP JSON protocol is used.\
\
To make sure that no old user information is received from the connection use logout parameter. If set, logouts current connection.\
\
Example login link:\
https://api.pcloud.com/userinfo?getauth=1&logout=1&{AUTHENTICATION} \
\
There are two methods to identify the user

### username/password

With this method, the following pramters are passed in plain text:

|              |                             |
|--------------|-----------------------------|
| Parameter    | Description                 |
| **username** | string email of the user    |
| **password** | string password of the user |

This method should only be used over SSL connections.

### username/passworddigest/digest

Digest authentication - this is good when not using SSL connections.\
\
With this method, the following pramters are passed:

[TABLE]

In both cases the output will contain auth with the AUTHENTICATION_TOKEN.

\
{\
    "result": 0,\
    "auth": "AUTHENTICATION_TOKEN",\
    \
    ...\
    \
}\

## Logout

Logout is the process when the user leaves your application. To make this remove your application's auth cookie and delete all user's information.\
\
To make a logout use the method [logout](/methods/auth/logout.html) and pass the obtained token.

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
