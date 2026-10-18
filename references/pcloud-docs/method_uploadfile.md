# pCloud docs: methods/file/uploadfile.html

> Source: https://docs.pcloud.com/methods/file/uploadfile.html

## uploadfile

Name

uploadfile

Auth

yes

Description

Upload a file.\
\
String path or int folderid specify the target directory. If both are omitted the root folder is selected.\
\
Parameter string progresshash can be passed. Same should be passed to [uploadprogress](/methods/file/uploadprogress.html) method.\
\
If nopartial is set, partially uploaded files will not be saved (that is when the connection breaks before file is read in full). If renameifexists is set, on name conflict, files will not be overwritten but renamed to name like filename (2).ext.\
\
Multiple files can be uploaded, using POST with multipart/form-data encoding. If passed by POST, the parameters must come before files. All files are accepted, the name of the form field is ignored. Multiple files can come one or more HTML file controls.\
\
Filenames must be passed as filename property of each file, that is - the way browsers send the file names.\
\
If a file with the same name already exists in the directory, it is overwritten and old one is saved as revision. Overwriting a file with the same data does nothing except updating the modification time of the file.

URL

https://api.pcloud.com/uploadfile

Required

|              |                                           |
|--------------|-------------------------------------------|
| Parameter    | Description                               |
| **path**     | string path to the folder(discouraged)    |
| **folderid** | int id of the folder                      |
| **filename** | string the filename of each uploaded file |

Optional

|  |  |
|----|----|
| Parameter | Description |
| **nopartial** | int If is set, partially uploaded files will not be saved |
| **progresshash** | string hash used for observing upload progress |
| **renameifexists** | int if set, the uploaded file will be renamed, if file with the requested name exists in the folder. |
| **mtime** | int if set, file modified time is set. Have to be unix time seconds. |
| **ctime** | int if set, file created time is set. It's required to provide mtime to set ctime. Have to be unix time seconds. |

Output

Returns two arrays - fileids and [metadata](/structures/metadata.html).

Example

{\
    "result": 0,\
    "fileids": \[\
        1729212\
    \],\
    "metadata": \[\
        {\
          "ismine": true,\
          "id": "f1729212",\
          "created": "Wed, 02 Oct 2013 14:29:11 +0000",\
          "modified": "Wed, 02 Oct 2013 14:29:11 +0000",\
          "hash": 10681749967730527559,\
          "isshared": false,\
          "isfolder": false,\
          "category": 1,\
          "parentfolderid": 0,\
          "icon": "image",\
          "fileid": 1729212,\
          "height": 600,\
          "width": 900,\
          "path": "\\/Simple image.jpg",\
          "name": "Simple image.jpg",\
          "contenttype": "image\\/jpeg",\
          "size": 73269,\
          "thumb": true\
        }\
    \]\
}\
\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2005** | Directory does not exist. |
| **2008** | User is over quota. |
| **2041** | Connection broken. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |
| **5001** | Internal upload error. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
