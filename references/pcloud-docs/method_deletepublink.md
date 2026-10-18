# pCloud docs: methods/public_links/deletepublink.html

> Source: https://docs.pcloud.com/methods/public_links/deletepublink.html

## deletepublink

Name

deletepublink

Auth

yes

Description

Delete a specified public link

URL

https://api.pcloud.com/deletepublink

Required

|            |                                      |
|------------|--------------------------------------|
| Parameter  | Description                          |
| **linkid** | int the ID of the link to be deleted |

Example

{\
    result: 0\
}\

### Errors

|          |                                            |
|----------|--------------------------------------------|
| Code     | Description                                |
| **1000** | Log in required.                           |
| **1030** | Please provide 'linkid'.                   |
| **2000** | Log in failed.                             |
| **2027** | Invalid or already deleted link.           |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later.           |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
