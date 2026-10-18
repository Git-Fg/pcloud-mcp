# pCloud docs: methods/oauth_2.0/oauth2_token.html

> Source: https://docs.pcloud.com/methods/oauth_2.0/oauth2_token.html

## oauth2_token

Name

oauth2_token

Auth

no

Description

This method is used when an app is using the code flow. The app calls this method to obtain a bearer token, after the user had authorized the app.\
\
This method expects the app's key and secret.\
\
Also the code received from the redirect from [oauth2_token](/methods/oauth_2.0/oauth2_token.html) is required.

URL

https://api.pcloud.com/oauth2_token

Required

|  |  |
|----|----|
| Parameter | Description |
| **client_id** | string - id of the application |
| **client_secret** | string - secret code for the application |
| **code** | code - code returned to the redirect from authorize page |

Output

After the code is validted, the method returns the object with fields:

|  |  |
|----|----|
| Parameter | Description |
| **access_token** | string A token that could be used to call pCloud API methods. |
| **token_type** | string The type of the token (always bearer). |
| **uid** | int The ID of the user, who gave access to the app. |

Example

{\
    result: 0,\
    access_token: "dghdghdj",\
    token_type: "bearer",\
    uid: 34535\
}\

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
