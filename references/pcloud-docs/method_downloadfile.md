# pCloud docs: methods/file/downloadfile.html

> Source: https://docs.pcloud.com/methods/file/downloadfile.html

## downloadfile

Name

downloadfile

Auth

yes

Description

Download a file/s\
\
Downloads one or more files from links suplied in the url parameter (links separated by any amount of whitespace) to the folder identified by either path or folderid (or to the root folder if both are omitted).\
\
The parameter string progresshash can be passed. The same should be passed to [uploadprogress](/methods/file/uploadprogress.html) method.\
\
When monitoring progress with [uploadprogress](/methods/file/uploadprogress.html) the following fields will be present:

|                |                                          |
|----------------|------------------------------------------|
| Field          | Description                              |
| **urlcount**   | int number of URLs requested             |
| **urlready**   | int number of URLs already downloaded    |
| **urlworking** | int number of currently downloading URLs |
| **finished**   | bool true if all URLs are downloaded     |
| **files**      | array of objects                         |

Each record in files has:

[TABLE]

The files are saved with the names, that are defined from the urls given. These names could be set, using the parameter target, which should contain comma-separeted urlencoded list of the desired names. The n-th name in this sequence is given to the n-th url from url parameter.\
\
Note that not all urls could have name given with target. If so, leave the name empty ( 'name%20A,,name%20C' ), or stop the list on the last desired name (urls can be more than target names).

URL

https://api.pcloud.com/downloadfile

Required

|           |                                                    |
|-----------|----------------------------------------------------|
| Parameter | Description                                        |
| **url**   | string links separated by any amount of whitespace |

Optional

|  |  |
|----|----|
| Parameter | Description |
| **path** | string path to folder, in which to download the files |
| **folderid** | string folderid of the folder, in which to download the files |
| **target** | string desired names for the downloaded files |

If path or folderid are not present, then root folder is used

Output

The method returns when all files are downloaded (which might take time). On success metadata array with [metadata](/structures/metadata.html) of all downloaded files is returned.

Example

{\
    "result": 0,\
    "metadata": \[\
        {\
            "icon": "image",\
            "path": "\Simple image.jpg",\
            "isshared": false,\
            "ismine": true,\
            "fileid": 1736716,\
            "size": 15604,\
            "category": 1,\
            "name": "Simple image.jpg",\
            "created": "Wed, 02 Oct 2013 15:57:13 +0000",\
            "hash": 6306013028049022731,\
            "parentfolderid": 0,\
            "modified": "Wed, 02 Oct 2013 15:57:28 +0000",\
            "thumb": true,\
            "isfolder": false,\
            "height": 300,\
            "width": 222,\
            "id": "f1736716",\
            "contenttype": "image\\/jpeg"\
        }\
    \]\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1040** | Please provide 'url'. |
| **2000** | Log in failed. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2005** | Directory does not exist. |
| **2008** | User is over quota. |
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
