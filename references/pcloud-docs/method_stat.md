# pCloud docs: methods/file/stat.html

> Source: https://docs.pcloud.com/methods/file/stat.html

## stat

Name

stat

Auth

yes

Description

The stat API method returns information about the file pointed to by fileid or path. It's is recomended to use fileid.

URL

https://api.pcloud.com/stat

Required

|            |                                       |
|------------|---------------------------------------|
| Parameter  | Description                           |
| **path**   | string path to the file (discouraged) |
| **fileid** | int id of the file                    |

Output

Returns [metadata](/structures/metadata.html).

Example

{\
    "result": 0,\
    "metadata": {\
      "ismine": true,\
      "id": "f1729212",\
      "created": "Wed, 02 Oct 2013 14:29:11 +0000",\
      "modified": "Wed, 02 Oct 2013 14:29:11 +0000",\
      "hash": 10681749967730527559,\
      "isshared": false,\
      "isfolder": false,\
      "category": 1,\
      "parentfolderid": 0,\
      "icon": "image",\
      "fileid": 1729212,\
      "height": 600,\
      "width": 900,\
      "path": "\\/Simple image.jpg",\
      "name": "Simple image.jpg",\
      "contenttype": "image\\/jpeg",\
      "size": 73269,\
      "thumb": true\
    }\
}\
\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2041** | Connection broken. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |
| **5001** | Internal upload error. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
