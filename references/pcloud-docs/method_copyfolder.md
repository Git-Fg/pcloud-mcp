# pCloud docs: methods/folder/copyfolder.html

> Source: https://docs.pcloud.com/methods/folder/copyfolder.html

## copyfolder

Name

copyfolder

Auth

yes

Description

Copies a folder identified by folderid or path to either topath or tofolderid.

URL

https://api.pcloud.com/copyfolder

Required

|                |                                  |
|----------------|----------------------------------|
| Parameter      | Description                      |
| **folderid**   | int id of the source folder      |
| **path**       | string path of the source folder |
| **tofolderid** | int id of destination folder     |
| **topath**     | string destination path          |

Optional

|  |  |
|----|----|
| Parameter | Description |
| **noover** | int If it is set and files with the same name already exist, no overwriting will be preformed and error 2004 will be returned |
| **skipexisting** | int If set will skip files that already exist |
| **copycontentonly** | int If it is set only the content of source folder will be copied otherwise the folder itself is copied |

Output

Returns [metadata](/structures/metadata.html) of the created folder.

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
| **1016** | No full topath or toname/tofolderid provided. |
| **1037** | Please provide at least one of 'topath', 'tofolderid' or 'toname'. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2004** | File or folder alredy exists. |
| **2005** | Directory does not exist. |
| **2008** | User is over quota. |
| **2023** | You are trying to place shared folder into another shared folder. |
| **2119** | Can not create non-encrypted file in encrypted folder. |
| **2206** | Can not copy folder into itself. |
| **2207** | Can not copy folder to subfolder of itself |
| **2208** | Target folder does not exist |
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
