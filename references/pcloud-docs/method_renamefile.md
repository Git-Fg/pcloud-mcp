# pCloud docs: methods/file/renamefile.html

> Source: https://docs.pcloud.com/methods/file/renamefile.html

## renamefile

Name

renamefile

Auth

yes

Description

Rename a file\
\
Renames (and/or moves) a file identified by fileid or path to either topath (if topath is a foldername without new filename it MUST end with slash - */newpath/*) or tofolderid/toname (one or both can be provided).\
\
If the destination file already exists it will be replaced atomically with the source file, in this case the metadata will include deletedfileid with the fileid of the old file at the destination, and the source and destination files revisions will be merged together.

URL

https://api.pcloud.com/renamefile

Required

|                |                                                 |
|----------------|-------------------------------------------------|
| Parameter      | Description                                     |
| **fileid**     | int ID of the renamed file                      |
| **path**       | string Path to the renamed file                 |
| **topath**     | string Destination path of renamed file         |
| **tofolderid** | int Id of the folder to which the file is moved |
| **toname**     | string Destination filename of the renamed file |

Use fileid or path

Output

On success returns renamed file's [metadata](/structures/metadata.html) with deletedfileid if merged file.

Example

{\
    "result": 0,\
    "metadata": {\
        "id": "f1729212",\
        "fileid": 1729212,\
        "size": 73269,\
        "isfolder": false,\
        "hash": 10681749967730527559,\
        "isshared": false,\
        "thumb": true,\
        "height": 600,\
        "contenttype": "image\\/jpeg",\
        "icon": "image",\
        "created": "Wed, 02 Oct 2013 14:29:11 +0000",\
        "width": 900,\
        "modified": "Wed, 02 Oct 2013 16:07:40 +0000",\
        "ismine": true,\
        "name": "My picture.jpg",\
        "category": 1,\
        "parentfolderid": 0\
    }\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **1037** | Please provide at least one of 'topath', 'tofolderid' or 'toname'. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2005** | Directory does not exist. |
| **2008** | User is over quota. |
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
