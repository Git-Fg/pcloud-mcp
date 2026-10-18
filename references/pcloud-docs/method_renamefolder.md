# pCloud docs: methods/folder/renamefolder.html

> Source: https://docs.pcloud.com/methods/folder/renamefolder.html

## renamefolder

Name

renamefolder

Auth

yes

Description

Renames (and/or moves) a folder identified by folderid or path to either topath (if topath is a existing folder to place source folder without new name for the folder it MUST end with slash - /newpath/) or tofolderid/toname (one or both can be provided).

URL

https://api.pcloud.com/renamefolder

Output

Returns [metadata](/structures/metadata.html) of the renamed folder.

Example

{\
    "result": 0,\
    "metadata": {\
        "parentfolderid": 0,\
        "id": "d230807",\
        "modified": "Wed, 02 Oct 2013 13:23:35 +0000",\
        "thumb": false,\
        "created": "Wed, 02 Oct 2013 13:11:53 +0000",\
        "folderid": 230807,\
        "ismine": true,\
        "isshared": false,\
        "isfolder": true,\
        "name": "Simple Folder",\
        "icon": "folder"\
    }\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1002** | No full path or folderid provided. |
| **1017** | Invalid 'folderid' provided. |
| **1037** | Please provide at least one of 'topath', 'tofolderid' or 'toname'. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2004** | File or folder alredy exists. |
| **2005** | Directory does not exist. |
| **2008** | User is over quota. |
| **2023** | You are trying to place shared folder into another shared folder. |
| **2042** | Cannot rename the root folder. |
| **2043** | Cannot move a folder to a subfolder of itself. |
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
