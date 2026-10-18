# pCloud docs: methods/file/copyfile.html

> Source: https://docs.pcloud.com/methods/file/copyfile.html

## copyfile

Name

copyfile

Auth

yes

Description

Takes one file and copies it as another file in the user's filesystem.\
\
Expects fileid or path to identify the source file and tofolderid+toname or topath to identify destination filename.\
\
If toname is ommited, original filename is used.\
\
The same is true if the last character of topath is '/' (slash), thus identifying only the target folder. The target file will be separate, newly created (with current creation time unless old file is overwritten) independent file.\
\
Any future operations on either the source or destination file will not modify the other one.\
\
This call is useful when you want to create a public link from somebody else's file (shared with you).

URL

https://api.pcloud.com/copyfile

Required

|                |                                |
|----------------|--------------------------------|
| Parameter      | Description                    |
| **fileid**     | int id of the target file      |
| **path**       | string path to the target file |
| **tofolderid** | int id of destination folder   |
| **topath**     | string destination path        |

Note that not all are required at single method call

Optional

|  |  |
|----|----|
| Parameter | Description |
| **toname** | string name of the destination file. If omitted, then the original filename is used |
| **noover** | int If it is set and file with the specified name already exists, no overwriting will be preformed |
| **mtime** | int if set, file modified time is set. Have to be unix time seconds. |
| **ctime** | int if set, file created time is set. It's required to provide mtime to set ctime. Have to be unix time seconds. |

Output

Upon success returns [metadata](/structures/metadata.html) of the destination file ( the copy result ).

Example

{\
    "result": 0,\
    "metadata": {\
        "category": 1,\
        "width": 900,\
        "thumb": true,\
        "created": "Wed, 02 Oct 2013 15:05:17 +0000",\
        "hash": 10681749967730527559,\
        "icon": "image",\
        "ismine": true,\
        "name": "Simple image.jpg",\
        "modified": "Wed, 02 Oct 2013 15:05:17 +0000",\
        "isfolder": false,\
        "contenttype": "image\\/jpeg",\
        "fileid": 1732283,\
        "isshared": false,\
        "id": "f1732283",\
        "size": 73269,\
        "parentfolderid": 28110,\
        "height": 600\
    }\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **1016** | No full topath or toname/tofolderid provided. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2004** | File or folder alredy exists. |
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
