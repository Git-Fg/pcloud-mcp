# pCloud docs: methods/public_links/getfilepublink.html

> Source: https://docs.pcloud.com/methods/public_links/getfilepublink.html

## getfilepublink

This method can't be used from web applications. Referrer is restricted to pcloud.com.

Name

getfilepublink

Auth

yes

Description

Creates and return a public link to a file.\
\
The file is identified by fileid or path.

URL

https://api.pcloud.com/getfilepublink

Required

|            |                                         |
|------------|-----------------------------------------|
| Parameter  | Description                             |
| **fileid** | int file id of the file for public link |
| **path**   | string path to the file for public link |

Use path or fileid

Optional

|  |  |
|----|----|
| Parameter | Description |
| **expire** | datetime Datetime when the link will stop working |
| **maxdownloads** | int Maximum number of downloads for this file |
| **maxtraffic** | int Maximum traffic that this link will consume (in bytes, started downloads will not be cut to fit in this limit) |
| **shortlink** | int If set, a short link will also be generated |
| **linkpassword** | string Sets password for the link. |

Output

On success returns

[TABLE]

\
If shortlink is set when calling, additonal\
\

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
| **1004** | No fileid or path provided. |
| **1013** | Date/time format not understood. |
| **2000** | Log in failed. |
| **2002** | A component of parent directory does not exist. |
| **2009** | File not found. |
| **2010** | Invalid path. |
| **2014** | Please verify your email address to preform this action. |
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
