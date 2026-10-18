# pCloud docs: methods/trash/trash_restore.html

> Source: https://docs.pcloud.com/methods/trash/trash_restore.html

## trash_restore

Name

trash_restore

Auth

yes

Description

Restores files or folders from the Trash back to the filesystem.\
\
The destination, where the data will be restored can be automatically calculated via [trash_restorepath](/methods/trash/trash_restorepath.html) or it could be specified by the user (use restoreto parameter).\
\
If folderid='0', then all data in the Trash will be restored, as close to their original positions, as possible. If restoreto is set, then all data in the Trash will be placed into this folder.

If the destination is a shared folder, then a user to which the folder was shared, will need CREATE access to the folder.

If the current user used space + the resotred files size is greater than the user quota, then this method will restore, until the first file that goes over quota is restored. Then it will raise an error.

URL

https://api.pcloud.com/trash_restorepath

Required

|              |                                      |
|--------------|--------------------------------------|
| Parameter    | Description                          |
| **fileid**   | int file id of the restored file     |
| **folderid** | int folder id of the restored folder |

Use fileid or folderid

Optional

|  |  |
|----|----|
| Parameter | Description |
| **restoreto** | int If given, then this folder will be chosen as a destination of the restored data. |
| **metadata** | int If set and restoring a folder, then the metadata of the folder will have contents filled with the information about files and folders in the restired folder. |

Output

On success returns the [metadata](/structures/metadata.html) of the restored file or folder.\
\
If the root of the trash is restored and restoreto is specified, then the metadata is shown for the restoreto folder.\
\
Else if restoreto is not specified, then result is a list restored of [metadatas](/structures/metadata.html) of the restored files / folders.

Example

{\
    result: 0,\
    metadata: {\
        name: "Deleted folder",\
        folderid: 236427,\
        id: "d236427",\
        parentfolderid: 0,\
        thumb: false,\
        isfolder: true,\
        isshared: false,\
        ismine: true,\
        modified: "Sat, 16 Dec 2013 16:20:00 +0000",\
        created: "Tue, 03 Dec 2013 15:50:22 +0000",\
        isdeleted: false,\
        icon: "folder",\
        contents: \[\
        \]\
    }\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1017** | Invalid 'folderid' provided. |
| **1018** | Invalid 'fileid' provided. |
| **1053** | Please provide 'fileid' or 'folderid'. |
| **1054** | Please provide valid 'restoreto'. |
| **2000** | Log in failed. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2005** | Directory does not exist. |
| **2008** | User is over quota. |
| **2009** | File not found. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |

2005 will be raised if:

- restored folder is not found
- destination folder was chosen with restoreto and is not found

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
