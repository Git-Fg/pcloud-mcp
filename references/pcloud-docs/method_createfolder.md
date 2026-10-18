# pCloud docs: methods/folder/createfolder.html

> Source: https://docs.pcloud.com/methods/folder/createfolder.html

## createfolder

Name

createfolder

Auth

yes

Description

Creates a folder.\
\
Expects either path string parameter (discouraged) or int folderid and string name parameters.

URL

https://api.pcloud.com/createfolder

Required

|              |                                        |
|--------------|----------------------------------------|
| Parameter    | Description                            |
| **path**     | string path to the folder(discouraged) |
| **folderid** | int id of the folder                   |
| **name**     | string name of the folder              |

Use path or folderid + name

Output

Upon success returns [metadata](/structures/metadata.html) structure.

Example

{\
    "result": 0,\
    "metadata": {\
        "created": "Wed, 02 Oct 2013 13:11:53 +0000",\
        "isfolder": true,\
        "parentfolderid": 0,\
        "icon": "folder",\
        "id": "d230807",\
        "path": "\\/new folder",\
        "modified": "Wed, 02 Oct 2013 13:11:53 +0000",\
        "thumb": false,\
        "folderid": 230807,\
        "isshared": false,\
        "ismine": true,\
        "name": "New folder"\
    }\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1001** | No full path or name/folderid provided. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2004** | File or folder alredy exists. |
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
