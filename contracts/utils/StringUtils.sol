//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library StringUtils {
    /// @notice checks if `str` is an alpha-numeric with emojis string
    /// @param _str string to check
    /// @return isAlphaNumeric return true if string is alpha-numeric
    function isAlphaNumeric(string memory _str) internal pure returns (bool) {
        bytes memory b = bytes(_str);
        for (uint i; i < b.length; i++) {
            bytes1 char = b[i];
            if (char == 0xF0) {
                bytes4 word = (bytes4(b[i + 3]) >> 24) |
                    (bytes4(b[i + 2]) >> 16) |
                    (bytes4(b[i + 1]) >> 8) |
                    b[i];
                if (!_isEmoji(word)) return false;
                i = i + 3;
            } else if (
                !(char > 0x2F && char < 0x3A) && !(char > 0x60 && char < 0x7B)
            ) return false;
        }
        return true;
    }

    /// @notice check if bytecode in utf8 is an emoji
    /// @param _utf8code utf8 bytecode
    /// @return isEmoji true if `_utf8code` is an emoji
    function _isEmoji(bytes4 _utf8code) private pure returns (bool) {
        return
            !(!(_utf8code >= 0xf09fa587 && _utf8code <= 0xf09fa7bf) && // 568
                !(_utf8code >= 0xf09fa9b0 && _utf8code <= 0xf09fabb8) && // 520
                !(_utf8code >= 0xf09f97ba && _utf8code <= 0xf09f998f) && // 469
                !(_utf8code >= 0xf09f9a80 && _utf8code <= 0xf09f9b85) && // 261
                !(_utf8code >= 0xf09fa4bc && _utf8code <= 0xf09fa585) && // 201
                !(_utf8code >= 0xf09fa48c && _utf8code <= 0xf09fa4ba) && // 46
                !(_utf8code >= 0xf09f9b95 && _utf8code <= 0xf09f9ba5) && // 16
                !(_utf8code >= 0xf09f9bb3 && _utf8code <= 0xf09f9bbc) && // 9
                !(_utf8code >= 0xf09f9b8b && _utf8code <= 0xf09f9b92) && // 7
                !(_utf8code >= 0xf09f9bab && _utf8code <= 0xf09f9bb0) && // 5
                _utf8code != 0xf09f9ba9);
    }

    /// @notice Returns the length of a given string
    /// @param _s The string to measure the length of
    /// @return The length of the input string
    function length(string memory _s) internal pure returns (uint256) {
        uint256 _len;
        uint256 i = 0;
        uint256 bytelength = bytes(_s).length;
        for (_len = 0; i < bytelength; _len++) {
            bytes1 b = bytes(_s)[i];
            if (b < 0x80) {
                i += 1;
            } else if (b < 0xE0) {
                i += 2;
            } else if (b < 0xF0) {
                i += 3;
            } else if (b < 0xF8) {
                i += 4;
            } else if (b < 0xFC) {
                i += 5;
            } else {
                i += 6;
            }
        }
        return _len;
    }
}
