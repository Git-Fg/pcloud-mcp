# pCloud docs: methods/folder/listfolder.html

> Source: https://docs.pcloud.com/methods/folder/listfolder.html

## listfolder

Name

listfolder

Auth

yes

Description

Receive data for a folder.\
\
Expects folderid or path parameter, returns folder's [metadata](/structures/metadata.html). The metadata will have contents field that is array of metadatas of folder's contents.\
\
Recursively listing the root folder is not an expensive operation.

URL

https://api.pcloud.com/listfolder

Required

|              |                                        |
|--------------|----------------------------------------|
| Parameter    | Description                            |
| **path**     | string path to the folder(discouraged) |
| **folderid** | int id of the folder                   |

Use path or folderid

Optional

|  |  |
|----|----|
| Parameter | Description |
| **recursive** | int If is set full directory tree will be returned, which means that all directories will have contents filed. |
| **showdeleted** | int If is set, deleted files and folders that can be undeleted will be displayed. |
| **nofiles** | int If is set, only the folder (sub)structure will be returned. |
| **noshares** | int If is set, only user's own folders and files will be displayed. |

Output

Returns folder's [metadata](/structures/metadata.html). The metadata will have contents field that is array of metadatas of folder's contents.

Example

{\
    result: 0,\
    metadata: {\
        icon: "folder",\
        id: "d0",\
        modified: "Thu, 19 Sep 2013 07:31:46 +0000",\
        path: "/",\
        thumb: false,\
        created: "Thu, 19 Sep 2013 07:31:46 +0000",\
        folderid: 0,\
        isshared: false,\
        isfolder: true,\
        ismine: true,\
        name: "/",\
        contents: \[\
            {\
                parentfolderid: 0,\
                id: "d230807",\
                modified: "Wed, 02 Oct 2013 13:23:35 +0000",\
                path: "/Simple Folder",\
                thumb: false,\
                created: "Wed, 02 Oct 2013 13:11:53 +0000",\
                folderid: 230807,\
                ismine: true,\
                isshared: false,\
                isfolder: true,\
                name: "Simple Folder",\
                icon: "folder"\
            }, {\
                icon: "audio",\
                contenttype: "audio/mpeg",\
                parentfolderid: 0,\
                modified: "Wed, 02 Oct 2013 13:23:19 +0000",\
                path: "/Simple Audio.mp3",\
                hash: 5380817599554757000,\
                thumb: false,\
                created: "Wed, 02 Oct 2013 13:23:19 +0000",\
                id: "f1723778",\
                ismine: true,\
                category: 3,\
                fileid: 1723778,\
                isshared: false,\
                isfolder: false,\
                name: "Simple Audio.mp3",\
                size: 11252576\
            }\]\
    }\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1002** | No full path or folderid provided. |
| **2000** | Log in failed. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2005** | Directory does not exist. |
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
