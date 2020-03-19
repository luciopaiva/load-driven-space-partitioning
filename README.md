
# Load-driven space partitioning

An algorithm to partition players by virtual locality. The partition strives to minimize information exchange between server nodes in a clustered environment.

To run:

    nvm install
    npm install

Create a file named `scenario.tsv` containing the points representing players. Write one line per player, where each line follows the format `X\tY`. Example:

    14952.48046875	-6583.5126953125
    -20128.62109375	-2235.225341796875
    -20463.77734375	-945.2243041992188
    -12661.47949218	-13400.3984375
    15809.737304687	-7867.32861328125

Then serve the root folder using any simple HTTP server and access `/index.html`.
