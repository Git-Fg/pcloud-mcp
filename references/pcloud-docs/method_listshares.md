# pCloud docs: methods/sharing/listshares.html

> Source: https://docs.pcloud.com/methods/sharing/listshares.html

## listshares

Name

listshares

Auth

yes

Description

List current shares and share requests.

URL

https://api.pcloud.com/listshares

Optional

|                |                                                     |
|----------------|-----------------------------------------------------|
| Parameter      | Description                                         |
| **norequests** | int If set, share requests will not be returned     |
| **noshares**   | int If set, established shares will not be returned |
| **noincoming** | int If set, hide incoming sub-objects in the result |
| **nooutgoing** | int If set, hide outgoing sub-objects in the result |

Output

Returns two objects shares and requests both with sub-objects incoming and outgoing.

Example

{\
    result: 0,\
    shares: {\
        incoming: \[ \],\
        outgoing: \[ \]\
    },\
    requests: {\
        incoming: \[ \],\
        outgoing: \[\
            {\
                tomail: "pcloud@pcloud.com",\
                cancreate: false,\
                folderid: 21385,\
                sharerequestid: ID,\
                canread: true,\
                expires: "Thu, 24 Oct 2013 10:41:29 +0000",\
                canmodify: false,\
                message: "The message",\
                candelete: false,\
                sharename: "My Share",\
                created: "Thu, 03 Oct 2013 10:41:29 +0000"\
            }\
        \]\
    }\
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
