# pCloud docs: structures/metadata.html

> Source: https://docs.pcloud.com/structures/metadata.html

# Metadata

The metadata for a file or folder normally consists of:

[TABLE]

Optionally image files may have:

|            |                                   |
|------------|-----------------------------------|
| Field      | Description                       |
| **width**  | int width of the image in pixels  |
| **height** | int height of the image of pixels |

Optionally audio files may have:

|             |             |
|-------------|-------------|
| Field       | Description |
| **artist**  | string      |
| **album**   | string      |
| **title**   | string      |
| **genre**   | string      |
| **trackno** | string      |

Optionally video files may have:

|  |  |
|----|----|
| Field | Description |
| **width** | int width of the video in pixels |
| **height** | int height of the video of pixels |
| **duration** | float duration of the video in seconds (floating point number sent as string) |
| **fps** | float frames per second rate of the video (floating point number sent as string) |
| **videocodec** | string codec used for enconding of the video |
| **audiocodec** | string codec used for enconding of the audio |
| **videobitrate** | int bitrate of the video in kilobits |
| **audiobitrate** | int bitrate of the audio in kilobits |
| **audiosamplerate** | int sampling rate of the audio in Hz |
| **rotate** | int indicates that video should be rotated (0, 90, 180 or 270) degrees when playing |

### Example for folder

\
{\
    "created": "Wed, 02 Oct 2013 13:11:53 +0000",\
    "isfolder": true,\
    "parentfolderid": 0,\
    "icon": "folder",\
    "id": "d230807",\
    "path": "\\/new folder",\
    "modified": "Wed, 02 Oct 2013 13:11:53 +0000",\
    "thumb": false,\
    "folderid": 230807,\
    "isshared": false,\
    "ismine": true,\
    "name": "new folder"\
}\

### Example for video file

\
{\
    "ismine": true,\
    "hash": 14802317402369427389,\
    "id": "f744",\
    "parentfolderid": 73,\
    "category": 2,\
    "fps": "25.00",\
    "audiobitrate": 189,\
    "icon": "video",\
    "created": "Fri, 26 Apr 2013 13:48:00 +0000",\
    "audiocodec": "aac",\
    "videocodec": "h264",\
    "size": 182339732,\
    "name": "Octane Team 2013 Winter Rally Training.mp4",\
    "duration": "245.33",\
    "audiosamplerate": 48000,\
    "rotate": 0,\
    "width": 1280,\
    "videobitrate": 5737,\
    "height": 720,\
    "isshared": false,\
    "fileid": 744,\
    "contenttype": "video\\/mp4",\
    "isfolder": false,\
    "modified": "Fri, 26 Apr 2013 14:52:02 +0000",\
    "thumb": true\
}\

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset
