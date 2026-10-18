# pCloud docs: methods/upload_links/uploadtolink.html

> Source: https://docs.pcloud.com/methods/upload_links/uploadtolink.html

## uploadtolink

Name

uploadtolink

Auth

no

Description

Upload file(s) to a upload link. Expects code.

Most things that apply to uploadfile also apply here, especially progresshash can be used in the same manner to monitor upload progress with uploadlinkprogress.

There is a slight difference that renameifexists is omitted and the uploaded file is always renamed when a file with the requested name exists in the upload link.

URL

https://api.pcloud.com/uploadtolink

Required

|  |  |
|----|----|
| Parameter | Description |
| **code** | string code of the link |

Optional

|  |  |
|----|----|
| Parameter | Description |
| **nopartial** | int If is set, partially uploaded files will not be saved |
| **progresshash** | string hash used for observing upload progress |

Example

{
    result: 0
}

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2041** | Connection broken. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |
| **5001** | Internal upload error. |
| **7002** | This link is deleted by the owner. |
| **7004** | This link has expired. |
| **7007** | This link has reached its space limit. |
| **7008** | This link has reached its file limit. |
