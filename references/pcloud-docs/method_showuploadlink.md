# pCloud docs: methods/upload_links/showuploadlink.html

> Source: https://docs.pcloud.com/methods/upload_links/showuploadlink.html

## showuploadlink

Name

showuploadlink

Auth

no

Description

Expects upload link code and returns back the link's comment and mail.

If the link is deleted or expired, returns proper 7xxx error, which should be expected by the implementations.

URL

https://api.pcloud.com/showuploadlink

Required

|  |  |
|----|----|
| Field | Description |
| **uploadlinkid** | int id of the upload link |

Optional

|  |  |
|----|----|
| Field | Description |
| **expire** | datetime set expiration date of the link |
| **deleteexpire** | int if set, link's expiration date is removed |
| **maxspace** | int alter the maximum available space (in bytes) of the link |
| **maxfiles** | int alter the maximum available files of the link |

Set maxspace or maxfiles to 0 to remove the given limit.

Example

{
    "result": 0
}

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1013** | Date/time format not understood. |
| **1036** | Please provide 'uploadlinkid'. |
| **2000** | Log in failed. |
| **2040** | Given 'uploadlinkid' not found. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |
