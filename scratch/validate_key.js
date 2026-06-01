const crypto = require('crypto');

const FIREBASE_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\n" +
"MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDy55xv9z1unv0w\n" +
"53yfhMPbqKKZnCok22e1VyrNj2BFs3SYSZ3hD0j2wB6lbIHrLvG1Fk1z4fPlYV+M\n" +
"H5rdRKB4n6rYvj63muHv8dXWEFuwR5LeeGUwfA/xWadyZeiFnq5cMtopl44QF6Xm\n" +
"HtdMNKE3cCyep6p6VhEx47owX6bozLlJCL+AyluBF+FDGqeBZtD5tOG79uADp4DC\n" +
"Gyto8tcJHLxUJw6wR0rT42k4nVZ2FcG/asSYBcWGi2rMRb6pvJxu1teyFyy3Yl4P\n" +
"Eq7z48NymdpB7B4smYHhJYSPwdNRL2FSYPUBBr0eBASO1Dr4fk70zRZF7d23B6mu\n" +
"H8AQom0DAgMBAAECggEAQLgIPObVleNDl6Od10zC+IQ6ao4qxm40+CKU83cXkgqp\n" +
"7qdyqtPtP11Z7P53sSdtXC/ojA8wcjXbBNUo6HqP/QOhvCUYRcg9GbbIIER0gYfY\n" +
"cHEImP39K3OVQ0w2w19Pmp4r9Xf9cHk0iRc/ivzc1Y4MPWtz5yuGYlIIOjpKGO1q\n" +
"J/OZW5I/xJWo2enrwCgpNZHdGW1W/xz5ZSi2a/CB7gVXybCD/P89f9gzRuDqW7Eb\n" +
"4DSqdnwAzpHcltCvsNMDTSR51nxW9oI9VhFbdHxFRs5BrsDXkaZgwGhfQfEu9uoS\n" +
"A0cHfYLGxELRWMCknsldGjnjQ3Pu/VThr91zq9cPBQKBgQD/EYzU+1v7Bi+RX/Qu\n" +
"pLLH3vucGyzNB28CJZk2SoCw2Io7E2AXIbax37iVAkUp0wbjeC9pSKvxVkj0rlwG\n" +
"G2GU2z40EIda/YZQGP6TIwrMSsp9V4SMBzkSuGQPsM+5qZ3fVr3dmNiMzNmSyIUs\n" +
"03rgdx6CEXrdpebzYU5srN0IRQKBgQDzyrCNHzbds14L+E8nS6SdRUh0Vy2hLme1\n" +
"qwrSi+W3DY0IKVZiSZqy5vZZR7UVeKURQ5SpHr5RNSdjSi1jS7+bvI/V7PW2dYej\n" +
"yHVj5eeMk9hbh7FgRv6nwM0hpsQrUcXRkkxl5oJDtniKg4WFp0DJ7d/CQcIj5sKH\n" +
"27jXdR5opwKBgQCewvW9u5bM8FS7T9ZVEf6VmZ1S1TdVhsL5ux1aRZVEfgPMMYsl\n" +
"2r40iOQDG56hIdCv1SbtiWY8mVBfvAdbZb+fP7fAAGm/oP3w7R3Hx4/5CLRwwACo\n" +
"h/ZmSI8/lPY2wfSaBwu22mQvf3INgvIhrKBXBs3ed7LaM2FFK9P8oLwTYQKBgFvU\n" +
"Z3hg35vW6n/7wmT82z7aUBZymB90iWAm02bHh3nSQuNmHsHbE8h7syOiHRW/Yf4E\n" +
"xMSHbgzMxs9hq4MRj1UsS8m6/jsCPlt1MLK2cOfE8ORZUnj/hQDPYPViCdZ/cNIm\n" +
"F1zy3PKAkxspu2vCumbVkUls16IKVBA0tYWC+jdVAoGAVmxGvmM+jhPddJwp53wI\n" +
"zCIjPcQku4M1MY5kKwxZWZzAamDP/YtM8UWlQ5ZQZwbIBWJVd5/E4j5XLPD+x9EQ\n" +
"DAtYtNOlfYSd7n/I98OBC1jaoezQi1eVK2aS1UpI4IW+sSnWu5TXLh1Lr4KRW244\n" +
"20jlO1ZDlglvF4O3kBdUi8=\n" +
"-----END PRIVATE KEY-----\n";

try {
  // Try to load the private key
  const key = crypto.createPrivateKey(FIREBASE_PRIVATE_KEY);
  console.log("SUCCESS: Key is valid PKCS#8 private key!");
} catch (err) {
  console.error("ERROR: Key is invalid!", err.message);
}
