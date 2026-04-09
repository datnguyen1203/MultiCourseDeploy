const { v2: cloudinary } = require("cloudinary");
const config = require("../Configurations/Config");

cloudinary.config({
    cloud_name: config.cloudinary.cloud_name,
    api_key: config.cloudinary.api_key,
    api_secret: config.cloudinary.api_secret,
    secure: true,
});

function uploadBufferToCloudinary(buffer, options = {}) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: options.folder,
                public_id: options.public_id,
                resource_type: options.resource_type || "auto",
                overwrite: true,
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(result);
            }
        );

        stream.end(buffer);
    });
}

function extractCloudinaryAssetInfo(url) {
    if (!url || !url.includes("cloudinary.com")) {
        return null;
    }

    const resourceMatch = url.match(/\/(image|video|raw)\/upload\//);
    const uploadIndex = url.indexOf("/upload/");

    if (!resourceMatch || uploadIndex === -1) {
        return null;
    }

    const resourceType = resourceMatch[1];
    let publicId = url.slice(uploadIndex + "/upload/".length);
    publicId = publicId.replace(/^v\d+\//, "");
    publicId = publicId.split("?")[0];
    publicId = publicId.replace(/\.[^./]+$/, "");

    if (!publicId) {
        return null;
    }

    return { publicId, resourceType };
}

async function deleteCloudinaryAsset(url) {
    const assetInfo = extractCloudinaryAssetInfo(url);
    if (!assetInfo) {
        return;
    }

    try {
        await cloudinary.uploader.destroy(assetInfo.publicId, {
            resource_type: assetInfo.resourceType,
        });
    } catch (error) {
        console.log("Error deleting Cloudinary asset:", error.message);
    }
}

module.exports = {
    uploadBufferToCloudinary,
    deleteCloudinaryAsset,
    extractCloudinaryAssetInfo,
};