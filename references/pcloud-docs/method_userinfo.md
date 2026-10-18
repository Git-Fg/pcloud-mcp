# pCloud docs: methods/general/userinfo.html

> Source: https://docs.pcloud.com/methods/general/userinfo.html

## userinfo

Name

userinfo

Auth

yes

Description

returns information about the current user. As there is no specific login method as credentials can be passed to any method, this is an especially good place for logging in with no particular action in mind.

URL

https://api.pcloud.com/userinfo

Output

|  |  |
|----|----|
| Parameters | Description |
| **email** | string email address of the user |
| **emailverified** | bool true if the user had verified it's email |
| **registered** | datetime when the user was registerd |
| **premium** | bool true if the user is premium |
| **premiumexpires** | datetime if premium is true: premiumexpires will be the date until the service is |
| **quota** | int in bytes |
| **usedquota** | int in bytes, so quite big numbers |
| **language** | string 2-3 characters lowercase languageid |

Example

{\
    result: 0, \
    userid: 1234,\
  email: pcloud@pcloud.com,\
  emailverified: true,\
  registered: "Mon, 18 Nov 2013 15:32:05 +0000",\
  language: "en",\
    premium: false,\
  usedquota: 500,\
  quota: 1000    \
}\

### Errors

|          |                                            |
|----------|--------------------------------------------|
| Code     | Description                                |
| **1000** | Log in required.                           |
| **2000** | Log in failed.                             |
| **4000** | Too many login tries from this IP address. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
