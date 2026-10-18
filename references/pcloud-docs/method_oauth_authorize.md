# pCloud docs: methods/oauth_2.0/authorize.html

> Source: https://docs.pcloud.com/methods/oauth_2.0/authorize.html

## authorize

Name

authorize

Auth

web page

Description

This is a web page which starts the OAuth 2.0 authorization flow. On this page the user logs in to pCloud and then decides whether to grant the access to your app.\
\
After the user takes the decision to give or not access to your application to his profile information and personal data, they will be redirected to the URI specified by redirect_uri.\
\
User's data could be store either in United States or in Europe. In the parameters in the redirect URL there will parameters locationid and hostname which will provide information about the location. See output parameters for more information.\
\
OAuth 2.0 has two different authorization flows:

- **Code flow** - returns a code via the redirect_uri redirect. This code after that should be converted inot a bearer token using [oauth2_token](/methods/oauth_2.0/oauth2_token.html) method.
- **Token (implicit) flow** - returns the bearer token via the redirect_uri redirect. It does not rquires your app to initiate a second call to pCloud API.

**Code flow** is recommended if the app is using a server.\
**Token flow** is appropriate for pure client-side apps - such for mobile devices or based only on JavaScript.\

URL

https://my.pcloud.com/oauth2/authorize

Required

|                   |                       |
|-------------------|-----------------------|
| Parameter         | Description           |
| **client_id**     | string id of the app. |
| **response_type** | string code or token. |

Optional

|  |  |
|----|----|
| Parameter | Description |
| **redirect_uri** | string where to redirect after approval, mandatory for token, optional for code (code will be displayed to the user in this case). |
| **state** | string opaque data that will be passed back to redirect_uri. |
| **force_reapprove** | bool if set, will force re-approval even if the application is already approved by the user. |
| **permissions** | a comma (,) separated list. If set additional permissions will appear in the approval form. Currently the only option is manageshares |

Output

On approval redirects to:\
\
**Code flow**\
\
These parameters are pased in the query string (after ?)

|  |  |
|----|----|
| Parameter | Description |
| **code** | string The authorization code that could be exchanged for a bearer token by calling [oauth2_token](/general/oauth_2.0/oauth2_token.html) |
| **state** | string The contents of the state parameter, that was passed. |
| **locationid** | number The ID for the location of the data center where the user is located. 1 - US, 2 - Europe |
| **hostname** | string The host name of the API server. Consequent API calls have to be made to that host name. |

\

redirect_uri?code=XXXXX&state=YYYYY&locationid=\[1 or 2\]&hostname=\[api.pcloud.com or eapi.pcloud.com\]\

\
**Token flow**\
These parameters are pased in the URI fragment (after \#)

|  |  |
|----|----|
| Parameter | Description |
| **locationid** | number The ID for the location of the data center where the user is located. 1 - US, 2 - Europe |
| **hostname** | string The host name of the API server. Consequent API calls have to be made to that host name. |
| **access_token** | string A token that could be used to call pCloud API methods. |
| **token_type** | string The type of the token (always bearer). |
| **uid** | int The ID of the user, who gave access to the app. |
| **state** | string The contents of the state parameter, that was passed. |

\

redirect_uri#access_token=XXXXX&token_type=bearer&uid=YYYYYY&state=ZZZZZZ&locationid=\[1 or 2\]&hostname=\[api.pcloud.com or eapi.pcloud.com\]\

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
