# pCloud docs: methods/file/deletefile.html

> Source: https://docs.pcloud.com/methods/file/deletefile.html

## deletefile

Name

deletefile

Auth

yes

Description

Delete a file identified by fileid or path.

URL

https://api.pcloud.com/deletefile

Required

|            |                                 |
|------------|---------------------------------|
| Parameter  | Description                     |
| **fileid** | int ID of the deleted file      |
| **path**   | string Path to the deleted file |

Use fileid or path

Output

On success returns file's [metadata](/structures/metadata.html) with isdeleted set.

Example

{\
    "result": 0,\
    "id": "139-0",\
    "metadata": {\
        "isfolder": false,\
        "icon": "image",\
        "size": 15604,\
        "name": "Simple image.jpg",\
        "category": 1,\
        "contenttype": "image\\/jpeg",\
        "parentfolderid": 0,\
        "isdeleted": true,\
        "hash": 6306013028049022731,\
        "ismine": true,\
        "isshared": false,\
        "id": "f1736716",\
        "height": 300,\
        "width": 222,\
        "modified": "Wed, 02 Oct 2013 16:00:40 +0000",\
        "thumb": true,\
        "created": "Wed, 02 Oct 2013 15:57:13 +0000",\
        "fileid": 1736716\
    }\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **2000** | Log in failed. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2009** | File not found. |
| **2010** | Invalid path. |
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
