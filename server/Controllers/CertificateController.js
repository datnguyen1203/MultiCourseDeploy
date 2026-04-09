const { createCanvas, loadImage } = require("canvas");
const Course = require("../Models/Courses");
const StudentCertificate = require("../Models/StudentCertificates");
const User = require("../Models/Users");
const StudentExamRS = require("../Models/StudentExamResults");

const width = 1000; // Increased width
const height = 700; // Increased height
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

const { uploadBufferToCloudinary } = require("../Utils/cloudinary");

exports.generateCertificate = async (req, res) => {
  try {
    const fullname = req.user.fullname;
    const course_id = req.params.course_id;

    const course = await Course.findById(course_id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const tutor = await User.findById(course.tutor);

    const studentExamRS = await StudentExamRS.findOne({
      student: req.user._id,
      course: course_id,
    });
    if (!studentExamRS) {
      return res.status(404).json({ message: "Exam result not found" });
    }

    const certificate = await StudentCertificate.findOne({
      student: req.user._id,
      course: course_id,
    });
    if (certificate) {
      return res.status(400).json({ message: "Certificate already exists" });
    }

    //nếu score < 80% của total mark thì không cấp chứng chỉ
    if (studentExamRS.score < 0.8 * studentExamRS.total_mark) {
      return res.status(400).json({ message: "You are not passed" });
    }

    // Nền có gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "#fdfbfb");
    gradient.addColorStop(1, "#ebedee");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Viền vàng sang trọng
    ctx.strokeStyle = "#d4af37";
    ctx.lineWidth = 6;
    ctx.strokeRect(30, 30, width - 60, height - 60);

    // Thêm viền phụ bên trong
    ctx.strokeStyle = "#8b7d6b";
    ctx.lineWidth = 2;
    ctx.strokeRect(50, 50, width - 100, height - 100);

    // Logo
    const logo = await loadImage("./public/images/logo.png");
    const logoWidth = 100;
    const logoHeight = 100;
    ctx.drawImage(logo, (width - logoWidth) / 2, 60, logoWidth, logoHeight);

    // Tiêu đề
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 40px Georgia";
    ctx.textAlign = "center";
    ctx.fillText("🎓 CERTIFICATE OF COMPLETION 🎓", width / 2, 180);

    // Tên học viên
    ctx.fillStyle = "#2c3e50";
    ctx.font = "italic 36px 'Times New Roman'";
    ctx.fillText(fullname || "John Doe", width / 2, 260);

    // Nội dung
    ctx.fillStyle = "#34495e";
    ctx.font = "22px Arial";
    ctx.fillText("has successfully completed the course", width / 2, 310);
    ctx.font = "bold 26px Arial";
    ctx.fillText(`"${course.title}"`, width / 2, 350);

    const watermark = await loadImage("./public/images/logo.png");

    // Kích thước logo watermark nhỏ
    const watermarkSize = 80;

    // Lặp các đường chéo
    for (let y = -height; y < height * 2; y += watermarkSize * 2) {
      for (let x = -width; x < width * 2; x += watermarkSize * 2) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-Math.PI / 4); // Xoay -45 độ
        ctx.globalAlpha = 0.09; // Độ trong suốt cho watermark
        ctx.drawImage(watermark, 0, 0, watermarkSize, watermarkSize);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1.0; // Trở lại bình thường cho phần nội dung chính

    // Ngày cấp
    ctx.font = "18px Arial";
    ctx.fillText(
      `Date Issued: ${new Date().toLocaleDateString()}`,
      width / 2,
      400
    );

    // Chữ ký
    if (tutor && tutor.fullname) {
      ctx.font = "20px Arial";
      ctx.fillText("Instructor", width - 210, height - 160);
      ctx.font = "italic 20px Arial";
      ctx.fillText(tutor.fullname, width - 210, height - 130);
    } else {
      console.error("Tutor not found or fullname is missing");
      return res.status(404).json({ message: "Tutor not found" });
    }

    // Tạo buffer từ canvas
    const buffer = Buffer.from(canvas.toBuffer("image/png").buffer);
    const uploadResult = await uploadBufferToCloudinary(buffer, {
      folder: `certificates/${course._id}`,
      public_id: `certificate_${Date.now()}`,
      resource_type: "image",
    });
    const publicUrl = uploadResult.secure_url;

    // Lưu thông tin chứng chỉ vào database
    const newCertificate = new StudentCertificate({
      title: "Certificate of Achievement",
      course: course_id,
      student: req.user._id,
      totalMark: studentExamRS.totalMark,
      isPassed: true,
      issue_date: new Date(),
      certificate_url: publicUrl,
    });
    await newCertificate.save();

    res.status(201).json({ certificateUrl: publicUrl });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getCertificate = async (req, res) => {
  try {
    const course_id = req.params.course_id;
    const course = await Course.findById(course_id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const certificate = await StudentCertificate.findOne({
      student: req.user._id,
      course: course_id,
    })
      .populate("course", "title")
      .exec();

    if (!certificate) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    res.status(200).json({ certificate });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getAllStudentCertificates = async (req, res) => {
  try {
    const certificates = await StudentCertificate.find({
      student: req.user._id,
    })
      .populate("course", "title")
      .exec();
    res.status(200).json({ certificates });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

exports.getTutorCertificate = async (req, res) => {
  try {
    const tutor = await User.findById(req.user._id);
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }
    res.status(200).json({ certificates: tutor.tutor_certificates });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//Upload tutor certificate
exports.uploadTutorCertificate = async (req, res) => {
  try {
    const newCertificates = req.body.certificates;
    const tutor = await User.findById(req.user._id);
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    const existsCertificate = [];

    if (tutor.tutor_certificates && tutor.tutor_certificates.length > 0) {
      for (let newCert of newCertificates) {
        // Kiểm tra xem chứng chỉ đã tồn tại chưa trước khi thêm vào
        const exists = tutor.tutor_certificates.some(
          (cert) => cert.title === newCert.title
        );
        if (exists) {
          existsCertificate.push(newCert.title);
        } else {
          tutor.tutor_certificates.push(newCert);
        }
      }

      if (existsCertificate.length > 0) {
        return res.status(400).json({
          message:
            "Certificate" +
            existsCertificate.map((cert) => " " + cert) +
            " already exists",
        });
      }
    } else {
      // Nếu `tutor_certificates` chưa tồn tại, gán trực tiếp mảng mới
      tutor.tutor_certificates = newCertificates;
    }
    await tutor.save();
    res.status(200).json({
      message: "Certificate uploaded",
      certificates: tutor.tutor_certificates,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

//Delete tutor certificate
exports.deleteTutorCertificate = async (req, res) => {
  try {
    const certificate_id = req.params.certificate_id;
    const tutor = await User.findById(req.user._id);
    if (!tutor) {
      return res.status(404).json({ message: "Tutor not found" });
    }

    tutor.tutor_certificates = tutor.tutor_certificates.filter(
      (cert) => cert._id.toString() !== certificate_id
    );
    await tutor.save();
    res.status(200).json({
      message: "Certificate deleted",
      certificates: tutor.tutor_certificates,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
