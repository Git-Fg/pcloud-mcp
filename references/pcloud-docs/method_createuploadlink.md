# pCloud docs: methods/upload_links/createuploadlink.html

> Source: https://docs.pcloud.com/methods/upload_links/createuploadlink.html

## createuploadlink

Name

createuploadlink

Auth

yes

Description

Creates upload link.

Expects folderid/path of the folder where the uploaded files will be saved. The folder must be owned by the user. Share may be subject to confirmation from the other user.

The folder to be shared is identified by folderid or path.

Also SHOULD have a comment parameter that contains any comments/instructions the user is willing to provide to uploading users. Comments are the only information that uploading users will see (they will not know username of the owner nor the name of the folder they are uploading into) so implementations SHOULD instruct users to fill in at least some description of what is expected from the uploaders (e.g. _Hey, that's Mike. Please upload any pictures you took at my wedding here._).

Optional parameter expire may indicate a date/time at which the link will stop working.

Also optionally maxspace and maxfiles may limit maximum total size (in bytes) and total number of files that can be uploaded.

URL

https://api.pcloud.com/createuploadlink

Required

|  |  |
|----|----|
| Parameter | Description |
| **folderid** | int folder id of the folder, where the uploaded files will be saved |
| **path** | string path to the shared folder, where the uploaded files will be saved |
| **comment** | string comment the user is willing to provide to uploading users |

Use path or folderid

Optional

|  |  |
|----|----|
| Parameter | Description |
| **expire** | datetime date/time at which the link will stop working. |
| **maxspace** | int limit maximum total size (in bytes) |
| **maxfiles** | int otal number of files that can be uploaded |

Output

On success returns

|  |  |
|----|----|
| Field | Description |
| **uploadlinkid** | int can be used to modify/delete this link |
| **link** | string full link to a page where files can be uploaded |
| **mail** | string an email address that also can be used to upload files to this link |
| **code** | string link's code that can be used to upload files. |

Example

{
    "result": 0,
    "code": "linkCode",
    "mail": "somewhere@u.pcloud.com",
    "uploadlinkid": linkID,
    "link": "https://my.pcloud.com/#page=puplink&code=linkCode"
}

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1002** | No full path or folderid provided. |
| **1013** | Date/time format not understood. |
| **1035** | Please provide 'comment'. |
| **2000** | Log in failed. |
| **2005** | Directory does not exist. |
| **2014** | Please verify your email address to preform this action. |
| **2039** | You have to own the folder for upload. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |
