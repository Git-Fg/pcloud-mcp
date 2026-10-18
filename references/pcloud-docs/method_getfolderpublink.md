# pCloud docs: methods/public_links/getfolderpublink.html

> Source: https://docs.pcloud.com/methods/public_links/getfolderpublink.html

## getfolderpublink

Name

getfolderpublink

Auth

yes

Description

Creates and returns a public link to a folder.\
\
The folder is identified by folderid or path.\
\
Same optional parameters as [getfilepublink](/methods/publik_links/getfilepublink.html).\
\
maxdownloads in this case limits total number of downloads from this folder (even for the same file).

URL

https://api.pcloud.com/getfolderpublink

Required

|              |                                             |
|--------------|---------------------------------------------|
| Parameter    | Description                                 |
| **folderid** | int folder id of the folder for public link |
| **path**     | string path to the folder for public link   |

Use path or folderid

Optional

|  |  |
|----|----|
| Parameter | Description |
| **expire** | datetime Datetime when the link will stop working |
| **maxdownloads** | int Maximum number of downloads from this folder (even for the same file). |
| **maxtraffic** | int Maximum traffic that this link will consume (in bytes, started downloads will not be cut to fit in this limit) |
| **shortlink** | int If set, a short link will also be generated |
| **linkpassword** | string Sets password for the link. |

Output

On success returns

[TABLE]

\
If shortlink is set when calling, additonal

[TABLE]

Example

{\
    "result": 0,\
    "linkid": Link ID,\
    "link": "https:\\/\\/my.pcloud.com\\/#page=publink&code=LinkCode",\
    "code": "LinkCode"\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1002** | No full path or folderid provided. |
| **1013** | Date/time format not understood. |
| **2000** | Log in failed. |
| **2005** | Directory does not exist. |
| **2014** | Please verify your email address to preform this action. |
| **2015** | Can not share root folder. |
| **2026** | You can only share your own files or folders. Copy the file to a folder you own if you need to share it. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
