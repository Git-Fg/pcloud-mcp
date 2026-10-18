# pCloud docs: methods/trash/trash_list.html

> Source: https://docs.pcloud.com/methods/trash/trash_list.html

## trash_list

Name

trash_list

Auth

yes

Description

Lists the contents of a folder in the Trash.\
\
The root folder of the Trash has id='0'.\
\
Outputs the [metadata](/structures/metadata.html) of the folder. This metadata will have contents field that is array of metadatas of folder's contents.\
\
Note that the metadata from this function has the additional field origparentfolderid in the metadata. This is the folder, in which the file or folder was, before it was moved to Trash.\
\
So the field parentfolderid is showing the position in the Trash.

Only files and folders that belong to the current user will be outputed from this method.

Recursively listing a Trash folder is not an expensive operation.\
\
This method is very simillar to [listfolder](/methods/folder/listfolder.html)

URL

https://api.pcloud.com/trash_list

Optional

|  |  |
|----|----|
| Parameter | Description |
| **folderid** | int the id of the Trash folder. The default is 0 - the root of the Trash. |
| **nofiles** | int If set, then no files will be included in the Trash list - only folders. |
| **recursive** | int If set, then the list will be recursive - the subfolders will have their folders and files included. |

Output

On success returns the [metadata](/structures/metadata.html) and the contents of the folder from the Trash.

Example

{\
    result: 0,\
    metadata: {\
        thumb: false,\
        path: "/",\
        isfolder: true,\
        isshared: false,\
        ismine: true,\
        modified: "Mon, 16 Sep 2013 12:10:32 +0000",\
        created: "Mon, 16 Sep 2013 12:10:32 +0000",\
        name: "/",\
        folderid: 0,\
        isdeleted: true,\
        icon: "folder",\
        id: "d0",\
        contents: \[\
            {\
                name: "Deleted folder",\
                folderid: 236427,\
                id: "d236427",\
                origparentfolderid: 123,\
                parentfolderid: 0,\
                thumb: false,\
                isfolder: true,\
                isshared: false,\
                ismine: true,\
                modified: "Sat, 14 Dec 2013 13:37:33 +0000",\
                created: "Tue, 03 Dec 2013 15:50:22 +0000",\
                isdeleted: true,\
                icon: "folder",\
                contents: \[ \]\
            },\
            {\
                name: "Deleted file",\
                id: "f76543",\
                fileid: 76543,\
                origparentfolderid: 6543,\
                parentfolderid: 0,\
                category: 3,\
                icon: "audio",\
                contenttype: "audio/x-mpegurl",\
                hash: 17079372075467340000,\
                size: 759,\
                isfolder: false,\
                thumb: false,\
                isshared: false,\
                modified: "Wed, 18 Sep 2013 10:18:46 +0000",\
                created: "Wed, 18 Sep 2013 10:18:14 +0000",\
                ismine: true,\
                isdeleted: true\
            }\
        \]\
    }\
}\

### Errors

|          |                                            |
|----------|--------------------------------------------|
| Code     | Description                                |
| **1000** | Log in required.                           |
| **1017** | Invalid 'folderid' provided.               |
| **2000** | Log in failed.                             |
| **2005** | Directory does not exist.                  |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later.           |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
